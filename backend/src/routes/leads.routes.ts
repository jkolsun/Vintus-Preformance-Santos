import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { validate } from "../middleware/validate.js";
import {
  contactSchema,
  consultationSchema,
  slotsQuerySchema,
} from "./schemas/leads.schemas.js";
import * as leadsService from "../services/leads.service.js";

const router = Router();

// POST /leads/contact — public — save contact form submission
router.post(
  "/contact",
  validate(contactSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await leadsService.createContactLead(req.body);

      res.status(201).json({
        success: true,
        data: { leadId: lead.id },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /leads/consultation — public — save consultation booking request
router.post(
  "/consultation",
  validate(consultationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lead = await leadsService.createConsultationLead(req.body);

      res.status(201).json({
        success: true,
        data: { leadId: lead.id },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /leads/slots?month=X&year=Y — public — return available slots
router.get(
  "/slots",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = slotsQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        // Default to current month/year
        const now = new Date();
        const result = await leadsService.getAvailableSlots(
          now.getMonth() + 1,
          now.getFullYear()
        );
        res.status(200).json({ success: true, data: result });
        return;
      }

      const result = await leadsService.getAvailableSlots(
        parsed.data.month,
        parsed.data.year
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
