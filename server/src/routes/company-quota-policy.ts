import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { putQuotaPolicySchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { agentService, companyFreezeService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { forbidden } from "../errors.js";

export function companyQuotaPolicyRoutes(db: Db) {
  const router = Router();
  const freezeSvc = companyFreezeService(db);
  const agents = agentService(db);

  async function assertQuotaPolicyAuth(req: Parameters<typeof assertCompanyAccess>[0], companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const agent = await agents.getById(req.actor.agentId);
    if (!agent || agent.companyId !== companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    if (agent.role !== "ceo" && agent.role !== "mtoka") {
      throw forbidden("Only CEO or MTOKA agents and board users may update the quota policy");
    }
  }

  router.get("/:companyId/quota-policy", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const policy = await freezeSvc.getQuotaPolicy(companyId);
    if (!policy) {
      res.status(404).json({ error: "No quota policy configured for this company" });
      return;
    }
    res.json(policy);
  });

  router.put("/:companyId/quota-policy", validate(putQuotaPolicySchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertQuotaPolicyAuth(req, companyId);
    const actor = getActorInfo(req);
    const policy = await freezeSvc.upsertQuotaPolicy(
      companyId,
      req.body,
      { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
    );
    res.json(policy);
  });

  return router;
}
