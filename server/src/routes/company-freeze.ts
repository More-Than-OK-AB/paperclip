import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { declareFreezeSchema, liftFreezeSchema } from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { agentService, companyFreezeService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

const FREEZE_AUTHORIZED_ROLES = new Set(["ceo", "mtoka", "platform-engineer"]);

export function companyFreezeRoutes(db: Db) {
  const router = Router();
  const freezeSvc = companyFreezeService(db);
  const agents = agentService(db);

  async function assertFreezeAuth(req: Parameters<typeof assertCompanyAccess>[0], companyId: string) {
    assertCompanyAccess(req, companyId);
    if (req.actor.type === "board") return;
    if (!req.actor.agentId) throw forbidden("Agent authentication required");
    const agent = await agents.getById(req.actor.agentId);
    if (!agent || agent.companyId !== companyId) {
      throw forbidden("Agent key cannot access another company");
    }
    if (!FREEZE_AUTHORIZED_ROLES.has(agent.role)) {
      throw forbidden("Only CEO, MTOKA, or platform-engineer agents and board users may manage freezes");
    }
  }

  router.get("/:companyId/freeze", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const freeze = await freezeSvc.getActiveFreeze(companyId);
    if (!freeze) {
      res.status(404).json({ error: "No active freeze" });
      return;
    }
    res.json(freeze);
  });

  router.put(
    "/:companyId/freeze",
    validate(declareFreezeSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      await assertFreezeAuth(req, companyId);
      const actor = getActorInfo(req);
      const { freeze, created } = await freezeSvc.declareOrUpdateFreeze(
        companyId,
        req.body,
        { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
      );
      res.status(created ? 201 : 200).json(freeze);
    },
  );

  router.post("/:companyId/freeze/lift", validate(liftFreezeSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    await assertFreezeAuth(req, companyId);
    const actor = getActorInfo(req);
    const lifted = await freezeSvc.liftFreeze(
      companyId,
      req.body,
      { agentId: actor.agentId, userId: actor.actorType === "user" ? actor.actorId : null },
    );
    res.json(lifted);
  });

  router.get("/:companyId/freezes", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const freezes = await freezeSvc.listFreezes(companyId, { limit, offset });
    res.json(freezes);
  });

  router.get("/:companyId/freeze/events", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const events = await freezeSvc.listFreezeEvents(companyId);
    res.json(events);
  });

  return router;
}
