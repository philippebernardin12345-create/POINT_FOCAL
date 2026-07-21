
const service = require("./admin.service");

async function login(
    req,
    res
) {
    try {

        const result =
            await service.login(
                req.body
            );

        return res.json(result);

    } catch (error) {

        return res.status(400).json({
            message: error.message
        });

    }
}

async function dashboard(
    req,
    res
) {
    return res.json({
        users: 0,
        leaders: 0,
        payments: 0,
        opportunities: 2
    });
}

async function users(
    req,
    res
) {
    return res.json([]);
}

async function settings(
    req,
    res
) {
    return res.json({
        ai: true
    });
}

module.exports = {
    login,
    dashboard,
    users,
    settings
};