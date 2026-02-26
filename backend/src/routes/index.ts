import { Router } from "express";
import authRoutes from "./auth.routes.js";
import intakeRoutes from "./intake.routes.js";
import checkoutRoutes from "./checkout.routes.js";
import onboardingRoutes from "./onboarding.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import workoutRoutes from "./workout.routes.js";
import readinessRoutes from "./readiness.routes.js";
import messagingRoutes from "./messaging.routes.js";
import adminRoutes from "./admin.routes.js";
import deviceRoutes from "./device.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/intake", intakeRoutes);
router.use("/checkout", checkoutRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/workout", workoutRoutes);
router.use("/readiness", readinessRoutes);
router.use("/messaging", messagingRoutes);
router.use("/admin", adminRoutes);
router.use("/device", deviceRoutes);

export default router;
