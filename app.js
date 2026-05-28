// app.js — Client Frontend avec validations strictes de chaînes et de formats
document.addEventListener("DOMContentLoaded", () => {
    
    const urlParams = new URLSearchParams(window.location.search);
    const sponsorRef = urlParams.get('ref') || 'ABCD1000';
    let langueSelectionnee = "fr"; 
    let timestampCollageAdresse = 0; 

    const trad = {
        fr: {
            placeholderCode: "Code d'invitation (Obligatoire)", placeholderEmail: "Votre adresse e-mail",
            placeholderPass: "Mot de passe", placeholderConf: "Confirmez le mot de passe",
            sponsor: "Sponsor actuel :", inscription: "S'inscrire", connexion: "Se connecter",
            dejaInscrit: "Déjà inscrit ? Connectez-vous", pasCompte: "Pas encore de compte ? S'inscrire",
            oublie: "Mot de passe oublié ?", recupTitre: "Récupération de compte",
            recupDesc: "Un e-mail contenant vos accès de secours vous sera envoyé.",
            btnRecup: "Récupérer mon mot de passe", retourCon: "Retour à la connexion",
            lireBout: "Veuillez lire tout le message...", continuer: "Continuer",
            wfTitre: "Regardez la vidéo pour débloquer la suite", wfClick: "CLIQUEZ ICI POUR OUVRIR YOUTUBE",
            wfMsgInit: "Cliquez sur le lecteur rouge ci-dessus pour ouvrir YouTube et lancer le chrono...",
            wfMsgCalcul: "« Laissez un LIKE, un COMMENTAIRE et ABONNEZ-VOUS pendant le compte à rebours... »",
            wfMsgOk: "« Visionnage validé ! Revenez sur Point Focal et cliquez sur le bouton rouge ci-dessous. »",
            btnObtenir: "J'obtiens le lien Victory Automatic",
            mlmAlerte: "ATTENTION : Compte temporaire. Sans inscription et validation réseau sous 48 heures, votre profil sera définitivement détruit.",
            mlmTitre: "Liaison de votre lien d'affiliation", mlmDesc: "Inscrivez-vous sur l'onglet Victory Automatic ouvert, puis collez votre propre lien d'affiliation ci-dessous :",
            btnMlm: "Enregistrer et passer à l'activation", btnDeco: "Déconnexion",
            payTitre: "Frais d'activation de la matrice", payDesc: "Pour activer votre système et valider votre licence, vous devez vous enregistrer sur Victory World Club via le lien ci-dessous (frais réseau de 5$ USDT BEP-20) :",
            btnPayOp: "S'inscrire sur Victory World (5$)", payAddrLabel: "1. Votre adresse de réception USDT (BEP-20) :",
            payTxLabel: "2. Le Hash de votre transaction (TxID) :", btnPayValider: "Activer mon compte définitivement",
            errChamps: "Veuillez remplir tous les champs.", errMatchPass: "Les deux mots de passe ne correspondent pas.",
            errVA: "Lien invalide. Doit commencer par https://victoryautomatic.com/user/register/ suivi de votre pseudo.", 
            errAddrBsc: "Adresse BEP-20 invalide (Doit faire exactement 42 caractères et commencer par 0x).",
            errTxBsc: "Hash TxID invalide (Doit faire exactement 66 caractères et commencer par 0x).", msgAnalyse: "Analyse en direct sur le nœud BNB Chain...",
            scTitre: "Votre système est actif !", scDesc: "Votre paiement a été validé avec succès. Voici votre lien d'invitation exclusif Point Focal. Partagez-le pour parrainer :",
            btnCopier: "Copier le lien d'invitation", msgCopie: "Copié !",
            pop1: "<h1>RÈGLES D'ENGAGEMENT</h1><p>L'algorithme ne met en avant que les comptes actifs et les vidéos qui génèrent de l'engagement authentique.</p><p>Pour intégrer la matrice globale de Point Focal, vous devez respecter les actions de la communauté : visionnage, mentions j'aime, et commentaires constructifs.</p>",
            pop2: "<h1>SÉCURITÉ BLOCKCHAIN</h1><p>Votre activation finale repose sur un transfert décentralisé sur la BNB Chain.</p><p><b>RÈGLES DU SERVEUR :</b><br>1. Chaque TxID doit être unique (envoi de 5$ USDT BEP-20).<br>2. Le Hash doit être obligatoirement généré APRÈS votre inscription.</p>"
        },
        en: {
            placeholderCode: "Invitation Code (Required)", placeholderEmail: "Your email address",
            placeholderPass: "Password", placeholderConf: "Confirm password",
            sponsor: "Current sponsor:", inscription: "Sign Up", connexion: "Log In",
            dejaInscrit: "Already registered? Log In", pasCompte: "No account yet? Sign Up",
            oublie: "Forgot password?", recupTitre: "Account Recovery",
            recupDesc: "An email containing your recovery details will be sent.",
            btnRecup: "Recover my password", retourCon: "Back to login",
            lireBout: "Please read the entire message...", continuer: "Continue",
            wfTitre: "Watch the video to unlock the next step", wfClick: "CLICK HERE TO OPEN YOUTUBE",
            wfMsgInit: "Click the red player above to open YouTube and start the timer...",
            wfMsgCalcul: "« Leave a LIKE, a COMMENT, and SUBSCRIBE during the countdown... »",
            wfMsgOk: "« View validated! Return to Point Focal and click the red button below. »",
            btnObtenir: "Get Victory Automatic Link",
            mlmAlerte: "WARNING: Temporary account. Without registration and network validation within 48 hours, your profile will be permanently destroyed.",
            mlmTitre: "Linking your affiliation link", mlmDesc: "Register on the opened Victory Automatic tab, then paste your own affiliation link below:",
            btnMlm: "Save and proceed to activation", btnDeco: "Log Out",
            payTitre: "Matrix Activation Fees", payDesc: "To activate your system, you must register on Victory World Club via the link below (network fee of $5 USDT BEP-20):",
            btnPayOp: "Register on Victory World ($5)", payAddrLabel: "1. Your receiving USDT (BEP-20) address:",
            payTxLabel: "2. Your transaction Hash (TxID):", btnPayValider: "Activate my account permanently",
            errChamps: "Please fill in all fields.", errMatchPass: "Passwords do not match.",
            errVA: "Invalid link. Must start with https://victoryautomatic.com/user/register/ followed by your username.", 
            errAddrBsc: "Invalid BEP-20 address (Must be exactly 42 characters and start with 0x).",
            errTxBsc: "Invalid TxID Hash (Must be exactly 66 characters and start with 0x).", msgAnalyse: "Live analysis on BNB Chain Node...",
            scTitre: "Your System is Active!", scDesc: "Your payment has been successfully verified. Here is your exclusive Point Focal invitation link:",
            btnCopier: "Copy Invitation Link", msgCopie: "Copied!",
            pop1: "<h1>RULES OF ENGAGEMENT</h1><p>The algorithm only promotes active accounts that generate authentic engagement.</p>",
            pop2: "<h1>BLOCKCHAIN SECURITY</h1><p>Each transaction must be unique ($5 USDT BEP-20) and created AFTER your registration.</p>"
        }
        // Tu pourras rajouter les clés 'pt' et 'es' de la même manière si besoin.
    };

    // Mapping Éléments DOM
    const blocLangue = document.getElementById("bloc-langue");
    const blocInscription = document.getElementById("bloc-inscription");
    const blocConnexion = document.getElementById("bloc-connexion");
    const blocOublie = document.getElementById("bloc-oublie");
    const pop1 = document.getElementById("popup-regles-1");
    const pop2 = document.getElementById("popup-regles-2");
    const scroller1 = document.getElementById("scroller-1");
    const scroller2 = document.getElementById("scroller-2");
    const btnContp1 = document.getElementById("btn-continuer-p1");
    const btnContp2 = document.getElementById("btn-continuer-p2");
    const zoneWorkflow = document.getElementById("zone-workflow");
    const zoneLiaisonMlm = document.getElementById("zone-liaison-mlm");
    const zonePaiement = document.getElementById("zone-paiement");
    const zoneSucces = document.getElementById("zone-succes");

    const insCode = document.getElementById("ins-code");
    const insEmail = document.getElementById("ins-email");
    const insPass = document.getElementById("ins-pass");
    const insConf = document.getElementById("ins-conf");
    const errInscription = document.getElementById("erreur-inscription");
    const btnInscription = document.getElementById("btn-inscription");
    const conEmail = document.getElementById("con-email");
    const conPass = document.getElementById("con-pass");
    const errConnexion = document.getElementById("erreur-connexion");
    const btnConnexion = document.getElementById("btn-connexion");
    const oubEmail = document.getElementById("oub-email");
    const errOublie = document.getElementById("erreur-oublie");
    const succesOublie = document.getElementById("succes-oublie");
    const btnRecuperer = document.getElementById("btn-recuperer");
    const timerVisuel = document.getElementById("timer-visuel");
    const messageDynamique = document.getElementById("message-dynamique");
    const btnObtenirLien = document.getElementById("btn-obtenir-lien");
    const mlmAdresseCible = document.getElementById("mlm-adresse-cible");
    const errMlm = document.getElementById("erreur-mlm");
    const btnValiderAdresse = document.getElementById("btn-valider-adresse");
    const fausseVideoYt = document.getElementById("fausse-video-yt");
    const btnOuvrirOpportunite2 = document.getElementById("btn-ouvrir-opportunite2");
    const cryptoAdresseCible = document.getElementById("crypto-adresse-cible");
    const cryptoTxid = document.getElementById("crypto-txid");
    const errPaiement = document.getElementById("erreur-paiement");
    const btnVerifierPaiement = document.getElementById("btn-verifier-paiement");
    const boxLienPf = document.getElementById("box-lien-pf");
    const btnCopierLien = document.getElementById("btn-copier-lien");

    // Init Code Référence
    insCode.value = sponsorRef;
    document.getElementById("nom-sponsor").textContent = sponsorRef;

    // Dispatch Langue
    document.querySelectorAll(".btn-langue").forEach(btn => {
        btn.addEventListener("click", (e) => {
            langueSelectionnee = e.target.getAttribute("data-lang") || "fr";
            appliquerTraduction();
            blocLangue.style.display = "none";
            blocInscription.style.display = "block";
        });
    });

    function appliquerTraduction() {
        const t = trad[langueSelectionnee] || trad["fr"];
        insCode.placeholder = t.placeholderCode;
        insEmail.placeholder = t.placeholderEmail;
        insPass.placeholder = t.placeholderPass;
        insConf.placeholder = t.placeholderConf;
        conEmail.placeholder = t.placeholderEmail;
        conPass.placeholder = t.placeholderPass;
        oubEmail.placeholder = t.placeholderEmail;
        
        document.getElementById("t-ins-sponsor").textContent = t.sponsor;
        btnInscription.textContent = t.inscription;
        btnConnexion.textContent = t.connexion;
        document.getElementById("vers-connexion").textContent = t.dejaInscrit;
        document.getElementById("vers-inscription").textContent = t.pasCompte;
        document.getElementById("vers-oublie").textContent = t.oublie;
        document.getElementById("t-ins-titre").textContent = t.inscription;
        document.getElementById("t-con-titre").textContent = t.connexion;
        document.getElementById("t-oub-titre").textContent = t.recupTitre;
        document.getElementById("t-oub-desc").textContent = t.recupDesc;
        btnRecuperer.textContent = t.btnRecup;
        document.getElementById("oublie-retour").textContent = t.retourCon;
        btnContp1.textContent = t.lireBout;
        btnContp2.textContent = t.lireBout;
        
        document.getElementById("t-wf-titre").textContent = t.wfTitre;
        document.getElementById("t-wf-click").textContent = t.wfClick;
        messageDynamique.textContent = t.wfMsgInit;
        btnObtenirLien.textContent = t.btnObtenir;
        
        document.getElementById("t-mlm-alerte").textContent = t.mlmAlerte;
        document.getElementById("t-mlm-titre").textContent = t.mlmTitre;
        document.getElementById("t-mlm-desc").textContent = t.mlmDesc;
        btnValiderAdresse.textContent = t.btnMlm;
        
        document.querySelectorAll(".btn-deco-global").forEach(b => b.textContent = t.btnDeco);
        
        document.getElementById("t-pay-titre").textContent = t.payTitre;
        document.getElementById("t-pay-desc").textContent = t.payDesc;
        btnOuvrirOpportunite2.textContent = t.btnPayOp;
        document.getElementById("t-pay-addr-label").textContent = t.payAddrLabel;
        document.getElementById("t-pay-tx-label").textContent = t.payTxLabel;
        btnVerifierPaiement.textContent = t.btnPayValider;

        document.getElementById("t-sc-titre").textContent = t.scTitre;
        document.getElementById("t-sc-desc").textContent = t.scDesc;
        btnCopierLien.textContent = t.btnCopier;

        scroller1.innerHTML = t.pop1;
        scroller2.innerHTML = t.pop2;
    }

    // Auto-Scroll défilement
    function activerAutoScroll(zoneScroller, boutonCible) {
        boutonCible.disabled = true;
        zoneScroller.scrollTop = 0;
        let scrollInterval = setInterval(() => {
            zoneScroller.scrollTop += 1; 
            if (zoneScroller.scrollTop + zoneScroller.clientHeight >= zoneScroller.scrollHeight - 2) {
                clearInterval(scrollInterval);
                boutonCible.disabled = false;
                boutonCible.textContent = (trad[langueSelectionnee] || trad["fr"]).continuer;
            }
        }, 35);
    }

    btnContp1.addEventListener("click", () => {
        pop1.style.display = "none"; pop2.style.display = "flex";
        activerAutoScroll(scroller2, btnContp2);
    });

    btnContp2.addEventListener("click", () => {
        pop2.style.display = "none";
        const dejaInscritVA = document.querySelector('input[name="deja_va"]:checked').value;
        if (dejaInscritVA === "oui") {
            // Bypass direct si déjà inscrit
            timestampCollageAdresse = Math.floor(Date.now() / 1000);
            zoneLiaisonMlm.style.display = "block";
        } else {
            zoneWorkflow.style.display = "block";
        }
    });

    // Masquage/Affichage MDP
    document.querySelectorAll(".chk-afficher").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            document.querySelectorAll(".pass-field").forEach(field => {
                field.type = e.target.checked ? "text" : "password";
            });
        });
    });

    // Navigation
    document.getElementById("vers-connexion").addEventListener("click", () => {
        blocInscription.style.display = "none"; blocConnexion.style.display = "block";
    });
    document.getElementById("vers-inscription").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocInscription.style.display = "block";
    });
    document.getElementById("vers-oublie").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocOublie.style.display = "block";
    });
    document.getElementById("oublie-retour").addEventListener("click", () => {
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    btnInscription.addEventListener("click", () => {
        errInscription.style.display = "none";
        const t = trad[langueSelectionnee] || trad["fr"];
        if (insCode.value.trim() === "" || insEmail.value === "" || insPass.value === "") {
            errInscription.textContent = t.errChamps; errInscription.style.display = "block"; return;
        }
        if (insPass.value !== insConf.value) {
            errInscription.textContent = t.errMatchPass; errInscription.style.display = "block"; return;
        }
        blocInscription.style.display = "none"; pop1.style.display = "flex";
        activerAutoScroll(scroller1, btnContp1);
    });

    btnConnexion.addEventListener("click", () => {
        errConnexion.style.display = "none";
        const t = trad[langueSelectionnee] || trad["fr"];
        if (conEmail.value === "" || conPass.value === "") {
            errConnexion.textContent = t.errChamps; errConnexion.style.display = "block"; return;
        }
        blocConnexion.style.display = "none"; pop1.style.display = "flex";
        activerAutoScroll(scroller1, btnContp1);
    });

    // Chrono Vidéo YouTube
    let chronoDemarre = false; let tempsVisionnage = 10; let intervalleVisionnage;
    fausseVideoYt.addEventListener("click", () => {
        window.open("https://youtu.be/9uPybhkqYw4", "_blank");
        const t = trad[langueSelectionnee] || trad["fr"];
        if (!chronoDemarre) {
            chronoDemarre = true; messageDynamique.textContent = t.wfMsgCalcul;
            intervalleVisionnage = setInterval(() => {
                tempsVisionnage--; timerVisuel.textContent = `${tempsVisionnage}s`;
                if (tempsVisionnage <= 0) {
                    clearInterval(intervalleVisionnage);
                    messageDynamique.textContent = t.wfMsgOk; btnObtenirLien.disabled = false;
                }
            }, 1000);
        }
    });

    btnObtenirLien.addEventListener("click", () => {
        window.open("https://victoryautomatic.com/user/register/" + insCode.value.trim(), "_blank");
        zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "block";
    });

    // 🛑 VALIDATION DU LIEN VICTORY AUTOMATIC
    btnValiderAdresse.addEventListener("click", () => {
        errMlm.style.display = "none";
        const t = trad[langueSelectionnee] || trad["fr"];
        const saisie = mlmAdresseCible.value.trim();
        
        const prefixeAttendu = "https://victoryautomatic.com/user/register/";
        if (saisie === "" || !saisie.startsWith(prefixeAttendu) || saisie.length <= prefixeAttendu.length) {
            errMlm.textContent = t.errVA; 
            errMlm.style.display = "block"; 
            return;
        }
        
        timestampCollageAdresse = Math.floor(Date.now() / 1000);
        zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "block";
    });

    btnOuvrirOpportunite2.addEventListener("click", () => {
        window.open("https://victoryworld.club/longa01", "_blank");
    });

    // 🛑 VALIDATION FINALE DES ADRESSES ET ENVOI AU SERVEUR NODE
    btnVerifierPaiement.addEventListener("click", async () => {
        errPaiement.style.display = "none";
        const t = trad[langueSelectionnee] || trad["fr"];
        const adresseSaisie = cryptoAdresseCible.value.trim();
        const txidSaisi = cryptoTxid.value.trim();

        if (adresseSaisie === "" || !adresseSaisie.startsWith("0x") || adresseSaisie.length !== 42) {
            errPaiement.textContent = t.errAddrBsc; errPaiement.style.display = "block"; return;
        }
        if (txidSaisi === "" || !txidSaisi.startsWith("0x") || txidSaisi.length !== 66) {
            errPaiement.textContent = t.errTxBsc; errPaiement.style.display = "block"; return;
        }

        btnVerifierPaiement.disabled = true; btnVerifierPaiement.textContent = t.msgAnalyse;

        try {
            const reponse = await fetch('http://localhost:3000/api/verifier-paiement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    adresseCible: adresseSaisie, 
                    txid: txidSaisi,
                    timestampLimite: timestampCollageAdresse 
                })
            });

            const resultat = await reponse.json();
            btnVerifierPaiement.disabled = false;
            btnVerifierPaiement.textContent = t.btnPayValider;

            if (resultat.succes) {
                // Collage & Extraction du pseudo final pour générer le lien Point Focal
                const tabSplitted = mlmAdresseCible.value.trim().split('/');
                const monPseudoInvitation = tabSplitted[tabSplitted.length - 1] || "user" + Math.floor(Math.random() * 9000);
                
                const lienPointFocalGenere = `${window.location.origin}${window.location.pathname}?ref=${monPseudoInvitation}`;
                boxLienPf.textContent = lienPointFocalGenere;

                zonePaiement.style.display = "none";
                zoneSucces.style.display = "block";
            } else {
                errPaiement.textContent = resultat.message; errPaiement.style.display = "block";
            }

        } catch (error) {
            btnVerifierPaiement.disabled = false; btnVerifierPaiement.textContent = t.btnPayValider;
            errPaiement.textContent = "Erreur de connexion avec le serveur local (port 3000)."; errPaiement.style.display = "block";
        }
    });

    // Bouton de copie du lien final
    btnCopierLien.addEventListener("click", () => {
        navigator.clipboard.writeText(boxLienPf.textContent).then(() => {
            const t = trad[langueSelectionnee] || trad["fr"];
            const texteOrigine = btnCopierLien.textContent;
            btnCopierLien.textContent = t.msgCopie;
            btnCopierLien.style.backgroundColor = "#ffffff";
            setTimeout(() => {
                btnCopierLien.textContent = texteOrigine;
                btnCopierLien.style.backgroundColor = "#00FF00";
            }, 2000);
        });
    });

    // Déconnexion / Réinitialisation globale
    document.querySelectorAll(".btn-deco-global").forEach(btn => {
        btn.addEventListener("click", () => {
            clearInterval(intervalleVisionnage);
            insCode.value = sponsorRef;
            insEmail.value = ""; insPass.value = ""; insConf.value = "";
            conEmail.value = ""; conPass.value = ""; oubEmail.value = "";
            mlmAdresseCible.value = ""; cryptoAdresseCible.value = ""; cryptoTxid.value = ""; 
            btnObtenirLien.disabled = true; chronoDemarre = false; tempsVisionnage = 10; timerVisuel.textContent = "10s";
            zoneWorkflow.style.display = "none"; zoneLiaisonMlm.style.display = "none"; zonePaiement.style.display = "none"; zoneSucces.style.display = "none";
            blocConnexion.style.display = "block";
        });
    });
});