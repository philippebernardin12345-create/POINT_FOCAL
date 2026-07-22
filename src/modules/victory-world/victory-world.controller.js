const service =
  require("./victory-world.service");

async function saveLink(
  req,
  res
) {
  try {
    const result =
      await service.saveLink(
        req.user.id,
        req.body
      );

    return res.status(200).json(
      result
    );

  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message
    });
  }
}

async function validatePayment(
  req,
  res
) {
  try {
    const result =
      await service.validatePayment(
        req.user.id,
        req.body
      );

    return res.status(200).json(
      result
    );

  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message
    });
  }
}

async function getStatus(
  req,
  res
) {
  try {
    const result =
      await service.getStatus(
        req.user.id
      );

    return res.status(200).json(
      result
    );

  } catch (error) {
    return res.status(400).json({
      success: false,
      message:
        error.message
    });
  }
}

module.exports = {
  saveLink,
  validatePayment,
  getStatus
};
