const service =
    require("./admin.service");


// ============================================================
// CONNEXION ADMINISTRATEUR
// ============================================================

async function login(
    req,
    res
) {
    try {
        const result =
            await service.login(
                req.body
            );

        return res.json(
            result
        );

    } catch (error) {
        console.error(
            "Erreur connexion admin :",
            error.message
        );

        return res.status(400).json({
            message:
                error.message
        });
    }
}


// ============================================================
// STATISTIQUES DU DASHBOARD
// ============================================================

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
        console.error(
            "Erreur dashboard admin :",
            error.message
        );

        return res.status(500).json({
            message:
                error.message
        });
    }
}


// ============================================================
// LISTE DES UTILISATEURS
// ============================================================

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
        console.error(
            "Erreur liste utilisateurs admin :",
            error.message
        );

        return res.status(500).json({
            message:
                error.message
        });
    }
}


// ============================================================
// PARAMÈTRES ADMINISTRATEUR
// ============================================================

async function settings(
    req,
    res
) {
    try {
        const result =
            await service.settings();

        return res.json(
            result
        );

    } catch (error) {
        console.error(
            "Erreur paramètres admin :",
            error.message
        );

        return res.status(500).json({
            message:
                error.message
        });
    }
}


// ============================================================
// AJOUTER UNE OPPORTUNITÉ
// ============================================================

async function createOpportunity(
    req,
    res
) {
    try {
        const result =
            await service.createOpportunity(
                req.body
            );

        return res.status(201).json({
            message:
                "Opportunité ajoutée avec succès.",

            opportunity:
                result
        });

    } catch (error) {
        console.error(
            "Erreur création opportunité :",
            error.message
        );

        return res.status(400).json({
            message:
                error.message
        });
    }
}

// ============================================================
// MODIFIER UNE OPPORTUNITÉ
// ============================================================

async function updateOpportunity(
    req,
    res
) {
    try {
        const result =
            await service.updateOpportunity(
                req.params.id,
                req.body
            );

        return res.json({
            message:
                "Opportunité modifiée avec succès.",

            opportunity:
                result
        });

    } catch (error) {
        console.error(
            "Erreur modification opportunité :",
            error.message
        );

        return res.status(400).json({
            message:
                error.message
        });
    }
}
// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    login,
    dashboard,
    users,
    settings,
    createOpportunity,
    updateOpportunity
};