const express =
  require("express");

const authMiddleware =
  require(
    "../../middlewares/auth.middleware"
  );

const controller =
  require(
    "./victory-world.controller"
  );

const router =
  express.Router();

router.post(
  "/link",
  authMiddleware,
  controller.saveLink
);

router.post(
  "/payment",
  authMiddleware,
  controller.validatePayment
);

router.get(
  "/status",
  authMiddleware,
  controller.getStatus
);

module.exports = router;
