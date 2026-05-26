import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { postUsageReportSchema } from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { companyFreezeService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

export function companyUsageRoutes(db: Db) {
  const router = Router();
  const freezeSvc = companyFreezeService(db);

  router.post("/:companyId/usage", validate(postUsageReportSchema), async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    if (req.actor.type !== "agent" || !req.actor.agentId) {
      throw forbidden("Only agents may post usage reports");
    }
    const report = await freezeSvc.postUsageReport(
      companyId,
      req.body,
      req.actor.agentId,
    );
    res.status(201).json(report);
  });

  router.get("/:companyId/usage/latest", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const report = await freezeSvc.getLatestUsageReport(companyId);
    if (!report) {
      res.status(404).json({ error: "No usage reports found for this company" });
      return;
    }
    res.json(report);
  });

  return router;
}
