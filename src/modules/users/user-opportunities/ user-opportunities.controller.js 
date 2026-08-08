 const service = require('./user-opportunities.service');

const saveLink = async (req, res) => {
  try {
    const userId = req.user.id;
    const { opportunitySlug, referralLink, targetAddress, paymentHash } = req.body;

    const result = await service.saveUserLink(userId, {
      opportunitySlug,
      referralLink,
      targetAddress,
      paymentHash
    });

    return res.status(200).json({
      success: true,
      message: 'Lien enregistré avec succès',
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getAvailableLink = async (req, res) => {
  try {
    const { opportunitySlug } = req.params;
    const result = await service.getAvailableLink(opportunitySlug);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Aucun lien disponible pour cette opportunité'
      });
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

const getUserLinks = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await service.getUserLinks(userId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = { saveLink, getAvailableLink, getUserLinks };
 
