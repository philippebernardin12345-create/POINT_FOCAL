// ---------------------------------------------------------------------
// MODULE DE CONFIGURATION DU TIMER VIDEO — POINT FOCAL V3 (FASTIFY)
// ---------------------------------------------------------------------
const { createClient } = require('@supabase/supabase-client');

// Connexion à Supabase (à alimenter via vos variables d'environnement)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function timerRoutes(fastify, options) {

    // 1. ROUTE : L'utilisateur clique sur "Je regarde la vidéo"
    fastify.post('/api/timer/start', {
        schema: {
            body: {
                type: 'object',
                required: ['userId'],
                properties: {
                    userId: { type: 'string', format: 'uuid' }
                }
            }
        }
    }, async (request, reply) => {
        const { userId } = request.body;

        try {
            const startedAt = new Date();
            // Calcul strict de l'heure de libération : +180 secondes
            const unlocksAt = new Date(startedAt.getTime() + 180 * 1000);

            // Insertion du jeton unique dans Supabase
            const { data, error } = await supabase
                .from('tokens_timer')
                .insert([
                    { 
                        user_id: userId, 
                        started_at: startedAt.toISOString(), 
                        unlocks_at: unlocksAt.toISOString() 
                    }
                ])
                .select('token')
                .single();

            if (error) throw error;

            // Envoi de la réponse via Fastify
            return reply.code(200).send({ 
                success: true, 
                token: data.token,
                message: "Timer démarré côté serveur. Visionnage requis de 180 secondes." 
            });

        } catch (err) {
            return reply.code(500).send({ success: false, error: err.message });
        }
    });

    // 2. ROUTE : Le frontend demande la validation à la fin du chrono
    fastify.post('/api/timer/verify', {
        schema: {
            body: {
                type: 'object',
                required: ['userId', 'token'],
                properties: {
                    userId: { type: 'string', format: 'uuid' },
                    token: { type: 'string', format: 'uuid' }
                }
            }
        }
    }, async (request, reply) => {
        const { userId, token } = request.body;

        try {
            // Récupération du token en base de données
            const { data: timer, error } = await supabase
                .from('tokens_timer')
                .select('*')
                .eq('token', token)
                .eq('user_id', userId)
                .single();

            if (error || !timer) {
                return reply.code(404).send({ success: false, message: "Jeton introuvable ou invalide." });
            }

            if (timer.est_utilise) {
                return reply.code(400).send({ success: false, message: "Ce jeton a déjà été validé." });
            }

            // VÉRIFICATION CHRONOMÉTRIQUE STRICTE
            const maintenant = new Date();
            const heureLiberation = new Date(timer.unlocks_at);

            if (maintenant < heureLiberation) {
                // L'utilisateur a triché ou modifié l'heure de son client
                const secondesRestantes = Math.ceil((heureLiberation - maintenant) / 1000);
                return reply.code(403).send({ 
                    success: false, 
                    message: `Contournement détecté. Il reste encore ${secondesRestantes} secondes de visionnage requis.` 
                });
            }

            // TOUT EST OK : On verrouille le token et on fait progresser l'utilisateur
            await supabase
                .from('tokens_timer')
                .update({ est_utilise: true })
                .eq('token', token);

            await supabase
                .from('utilisateurs')
                .update({ etape_actuelle: 3, derniere_activite: maintenant.toISOString() })
                .eq('id', userId);

            return reply.code(200).send({ 
                success: true, 
                message: "Étape vidéo validée. Accès au lien MLM autorisé." 
            });

        } catch (err) {
            return reply.code(500).send({ success: false, error: err.message });
        }
    });
}

module.exports = timerRoutes;