
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
    try {

        const result =
            await service.dashboard();

        return res.json(
            result
        );

    } catch (error) {

        return res.status(500).json({
            message:
                error.message
        });

    }
}
   

async function users(
    req,
    res
) {
    try {

        const result =
            await service.users();

        return res.json(
            result
        );

    } catch (error) {

        return res.status(500).json({
            message:
                error.message
        });

    }
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