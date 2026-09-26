const express =
  require("express");

const { authenticate: authMiddleware } =
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
  "/assign-sponsor",
  authMiddleware,
  controller.assignSponsor
);

router.post(
  "/link",
  authMiddleware,
  controller.saveLink
);

router.get(
  "/status",
  authMiddleware,
  controller.getStatus
);

module.exports = router;
