// app.js — Version V3 Multilingue avec double popups à défilement fluide et bypass conditionnel (Déjà inscrit sur VA)
document.addEventListener("DOMContentLoaded", () => {
    
    // 🟢 PARAMÈTRES URL ET DIRECTION DE BASE
    const urlParams = new URLSearchParams(window.location.search);
    const sponsorRef = urlParams.get('ref') || 'ABCD1000';
    let langueSelectionnee = "fr"; 
    let timestampCollageAdresse = 0; // Capturera la seconde précise où l'adresse cible est collée/générée

    // Dictionnaire multilingue complet
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
            payTitre: "Frais d'activation de la matrice", payDesc: "Pour activer votre système et valider votre licence, vous devez vous enregistrer sur Victory World Club via le lien ci-dessous (frais réseau de 5$) :",
            btnPayOp: "S'inscrire sur Victory World (5$)", payAddrLabel: "1. Votre adresse de réception USDT (BEP-20) :",
            payTxLabel: "2. Le Hash de votre transaction (TxID) :", btnPayValider: "Activer mon compte définitivement",
            errChamps: "Veuillez remplir tous les champs.", errMatchPass: "Les deux mots de passe ne correspondent pas.",
            errVA: "Veuillez entrer votre lien d'affiliation Victory Automatic valide.", errAddrBsc: "Adresse BEP-20 invalide (42 caractères, commençant par 0x).",
            errTxBsc: "Hash TxID invalide (66 caractères, commençant par 0x).", msgAnalyse: "Analyse temps réel sur la BNB Chain...",
            pop1: "<h1>RÈGLES D'ENGAGEMENT</h1><p>L'algorithme de recommandation ne met en avant que les comptes actifs et les vidéos qui génèrent de l'engagement authentique.</p><p>Pour intégrer la matrice globale de Point Focal, vous devez impérativement respecter les actions de soutien de la communauté : visionnage complet, mention j'aime systématique, et dépôt de commentaires constructifs.</p><p>Tout manquement ou utilisation de faux comptes de visionnage entraînera un bannissement irréversible du réseau.</p>",
            pop2: "<h1>SÉCURITÉ BLOCKCHAIN</h1><p>Votre activation finale repose sur un contrat intelligent décentralisé sur la BNB Chain.</p><p><b>RÈGLES DE CONTRÔLE DE NOTRE SERVEUR :</b><br>1. Chaque transaction (TxID) doit être unique et correspondre à un envoi réel de 5$ USDT (BEP-20).<br>2. L'adresse de réception saisie doit correspondre exactement aux logs de transfert.<br>3. Le Hash de transaction doit être obligatoirement postérieur à votre étape d'inscription sur Point Focal. Toute tentative d'utilisation d'un ancien Hash ou d'un Hash tiers déclenchera une alerte de triche automatisée.</p>"
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
            payTitre: "Matrix Activation Fees", payDesc: "To activate your system and validate your license, you must register on Victory World Club via the link below (network fee of $5):",
            btnPayOp: "Register on Victory World ($5)", payAddrLabel: "1. Your receiving USDT (BEP-20) address:",
            payTxLabel: "2. Your transaction Hash (TxID):", btnPayValider: "Activate my account permanently",
            errChamps: "Please fill in all fields.", errMatchPass: "Passwords do not match.",
            errVA: "Please enter your valid Victory Automatic affiliation link.", errAddrBsc: "Invalid BEP-20 address (42 chars, starting with 0x).",
            errTxBsc: "Invalid TxID Hash (66 chars, starting with 0x).", msgAnalyse: "Real-time analysis on the BNB Chain...",
            pop1: "<h1>RULES OF ENGAGEMENT</h1><p>The recommendation algorithm only promotes active accounts and videos that generate authentic engagement.</p><p>To join the Point Focal global matrix, you must strictly respect the community support actions: full viewing, systematic liking, and constructive comments.</p><p>Any failure or use of fake accounts will lead to an irreversible ban.</p>",
            pop2: "<h1>BLOCKCHAIN SECURITY</h1><p>Your final activation relies on a decentralized smart contract on the BNB Chain.</p><p><b>SERVER CONTROL RULES:</b><br>1. Each transaction (TxID) must be unique and match a real transfer of 5$ USDT (BEP-20).<br>2. The entered destination address must match the transfer logs precisely.<br>3. The transaction Hash must be strictly generated after your Point Focal signup timestamp. Any attempt to use an old or third-party Hash will trigger an automated anti-cheat block.</p>"
        },
        pt: {
            placeholderCode: "Código de convite (Obrigatório)", placeholderEmail: "Seu endereço de e-mail",
            placeholderPass: "Senha", placeholderConf: "Confirme a senha",
            sponsor: "Sponsor atual:", inscription: "Inscrever-se", connexion: "Conectar-se",
            dejaInscrit: "Já registrado? Conectar-se", pasCompte: "Não tem uma conta? Inscrever-se",
            oublie: "Esqueceu a senha?", recupTitre: "Recuperação de conta",
            recupDesc: "Um e-mail contendo seus dados de acesso será enviado.",
            btnRecup: "Recuperar minha senha", retourCon: "Voltar ao login",
            lireBout: "Por favor, leia a mensagem inteira...", continuer: "Continuar",
            wfTitre: "Assista ao vídeo para desbloquear o próximo passo", wfClick: "CLIQUE AQUI PARA ABRIR O YOUTUBE",
            wfMsgInit: "Clique no player vermelho acima para abrir o YouTube e iniciar o cronômetro...",
            wfMsgCalcul: "« Deixe um LIKE, um COMENTÁRIO e INSCREVA-SE durante a contagem regressiva... »",
            wfMsgOk: "« Visualização validada! Volte ao Point Focal e clique no botão vermelho abaixo. »",
            btnObtenir: "Obter link do Victory Automatic",
            mlmAlerte: "AVISO: Conta temporária. Sem inscrição e validação de rede em 48 horas, seu perfil será destruído permanentemente.",
            mlmTitre: "Vinculando seu link de afiliação", mlmDesc: "Cadastre-se na aba aberta do Victory Automatic e cole seu próprio link de afiliação abaixo:",
            btnMlm: "Salvar e prosseguir para ativação", btnDeco: "Sair",
            payTitre: "Taxas de Ativação da Matriz", payDesc: "Para ativar seu sistema e validar sua licença, você deve se registrar no Victory World Club através do link abaixo (taxa de rede de $5):",
            btnPayOp: "Registrar no Victory World ($5)", payAddrLabel: "1. Seu endereço de recebimento USDT (BEP-20):",
            payTxLabel: "2. Hash da sua transação (TxID):", btnPayValider: "Ativar minha conta permanentemente",
            errChamps: "Por favor, preencha todos os campos.", errMatchPass: "As senhas não coincidem.",
            errVA: "Por favor, insira seu link de afiliação válido do Victory Automatic.", errAddrBsc: "Endereço BEP-20 inválido (42 caracteres, começando com 0x).",
            errTxBsc: "Hash TxID inválido (66 caracteres, começando com 0x).", msgAnalyse: "Análise em tempo real na BNB Chain...",
            pop1: "<h1>REGRAS DE ENGAJAMENTO</h1><p>O algoritmo de recomendação apenas promove contas ativas e vídeos que geram engajamento autêntico.</p><p>Para ingressar na matriz global do Point Focal, você deve respeitar rigorosamente as ações de apoio comunitário: visualização completa, curtidas sistemáticas e comentários construtivos.</p><p>Qualquer falha ou uso de contas falsas resultará em banimento irreversível.</p>",
            pop2: "<h1>SEGURANÇA BLOCKCHAIN</h1><p>Sua ativação final depende de um contrato inteligente descentralizado na BNB Chain.</p><p><b>REGRAS DE CONTROLE DO SERVIDOR:</b><br>1. Cada transação (TxID) deve ser única e corresponder a um envio real de 5$ USDT (BEP-20).<br>2. O endereço de destino inserido deve corresponder exatamente aos logs de transferência.<br>3. O Hash da transação deve ser obrigatoriamente posterior ao registro da sua conta no Point Focal. Qualquer tentativa de usar um Hash antigo ou de terceiros ativará um bloqueio automatizado antifraude.</p>"
        },
        es: {
            placeholderCode: "Código de invitación (Obligatorio)", placeholderEmail: "Su correo electrónico",
            placeholderPass: "Contraseña", placeholderConf: "Confirme la contraseña",
            sponsor: "Sponsor actual:", inscription: "Registrarse", connexion: "Iniciar sesión",
            dejaInscrit: "¿Ya estás registrado? Iniciar sesión", pasCompte: "¿No tienes una cuenta? Registrarse",
            oublie: "¿Olvidó su contraseña?", recupTitre: "Recuperación de cuenta",
            recupDesc: "Se enviará un correo electrónico con sus datos de recuperación.",
            btnRecup: "Recuperar mi contraseña", retourCon: "Volver al inicio de sesión",
            lireBout: "Por favor, lea todo el mensaje...", continuer: "Continuar",
            wfTitre: "Mira el video para desbloquear el siguiente paso", wfClick: "HAGA CLIC AQUÍ PARA ABRIR YOUTUBE",
            wfMsgInit: "Haga clic en el reproductor rojo de arriba para abrir YouTube y comenzar el cronómetro...",
            wfMsgCalcul: "« Deje un LIKE, un COMENTARIO y SUSCRÍBASE durante la cuenta regresiva... »",
            wfMsgOk: "« ¡Visualización validada! Regrese a Point Focal y haga clic en el botón rojo de abajo. »",
            btnObtenir: "Obtener enlace de Victory Automatic",
            mlmAlerte: "ADVERTENCIA: Cuenta temporal. Sin registro y validación de red en 48 horas, su perfil será destruido permanentemente.",
            mlmTitre: "Vinculación de su enlace de afiliación", mlmDesc: "Regístrese en la pestaña abierta de Victory Automatic, luego pegue su propio enlace de afiliación a continuación:",
            btnMlm: "Guardar y proceder a la activación", btnDeco: "Cerrar sesión",
            payTitre: "Tarifas de Activación de la Matriz", payDesc: "Para activar su sistema y validar su licencia, debe registrarse en Victory World Club a través del enlace de abajo (tarifa de red de $5):",
            btnPayOp: "Registrarse en Victory World ($5)", payAddrLabel: "1. Su dirección de recepción USDT (BEP-20):",
            payTxLabel: "2. El Hash de su transacción (TxID):", btnPayValider: "Activar mi cuenta permanentemente",
            errChamps: "Por favor, rellene todos los campos.", errMatchPass: "Las contraseñas no coinciden.",
            errVA: "Por favor, introduzca su enlace de afiliación de Victory Automatic válido.", errAddrBsc: "Dirección BEP-20 inválida (42 caracteres, comenzando por 0x).",
            errTxBsc: "Hash TxID inválido (66 caracteres, comenzando por 0x).", msgAnalyse: "Análisis en tiempo real en la BNB Chain...",
            pop1: "<h1>REGLAS DE COMPROMISO</h1><p>El algoritmo de recomendación solo promueve cuentas activas y videos que generan un compromiso auténtico.</p><p>Para unirse a la matriz global de Point Focal, debe respetar estrictamente las acciones de apoyo comunitario: visualización completa, me gusta sistemático y comentarios constructivos.</p><p>Cualquier incumplimiento o uso de cuentas falsas resultará en una expulsión irreversible.</p>",
            pop2: "<h1>SEGURIDAD BLOCKCHAIN</h1><p>Su activación final se basa en un contrato inteligente descentralizado en la BNB Chain.</p><p><b>REGLAS DE CONTROL DEL SERVIDOR:</b><br>1. Cada transacción (TxID) debe ser única y corresponder a un envío real de 5$ USDT (BEP-20).<br>2. La dirección de destino ingresada debe coincidir exactamente con los registros de transferencia.<br>3. El Hash de la transacción debe ser obligatoriamente posterior al registro de su cuenta en Point Focal. Cualquier intento de utilizar un Hash antiguo o de terceros activará un bloqueo automatizado antifraude.</p>"
        }
    };

    // Blocs d'affichage principaux
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

    // Éléments d'interface traduisibles
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

    // INITIALISATION ET ROUTAGE DE LA LANGUE
    document.querySelectorAll(".btn-langue").forEach(btn => {
        btn.addEventListener("click", (e) => {
            langueSelectionnee = e.target.getAttribute("data-lang");
            appliquerTraduction();
            blocLangue.style.display = "none";
            blocInscription.style.display = "block";
        });
    });

    function appliquerTraduction() {
        const t = trad[langueSelectionnee];
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

        scroller1.innerHTML = t.pop1;
        scroller2.innerHTML = t.pop2;
    }

    // GESTION LECTURE COMPLETE DISCIPLINÉE (AUTO-SCROLL QUANTIFIÉ)
    function activerAutoScroll(zoneScroller, boutonCible) {
        boutonCible.disabled = true;
        zoneScroller.scrollTop = 0;
        
        let scrollInterval = setInterval(() => {
            zoneScroller.scrollTop += 1; 
            // Si l'utilisateur atteint le fond du texte
            if (zoneScroller.scrollTop + zoneScroller.clientHeight >= zoneScroller.scrollHeight - 2) {
                clearInterval(scrollInterval);
                boutonCible.disabled = false;
                boutonCible.textContent = trad[langueSelectionnee].continuer;
            }
        }, 35); // Vitesse de lecture calme et progressive
    }

    // INTERACTION CHEMIN DES POPUPS
    btnContp1.addEventListener("click", () => {
        pop1.style.display = "none";
        pop2.style.display = "flex";
        activerAutoScroll(scroller2, btnContp2);
    });

    btnContp2.addEventListener("click", () => {
        pop2.style.display = "none";
        
        // CONDITION CRITIQUE : L'utilisateur s'est-il déclaré déjà inscrit sur Victory Automatic ?
        const dejaInscritVA = document.querySelector('input[name="deja_va"]:checked').value;
        
        if (dejaInscritVA === "oui") {
            // BYPASS COMPLET : Pas de vidéo, pas de perte de temps, direction saisie du lien
            zoneLiaisonMlm.style.display = "block";
        } else {
            // Flux Standard pour les nouveaux
            zoneWorkflow.style.display = "block";
        }
    });

    // MASQUAGE / AFFICHAGE MOTS DE PASSE
    document.querySelectorAll(".chk-afficher").forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
            document.querySelectorAll(".pass-field").forEach(field => {
                field.type = e.target.checked ? "text" : "password";
            });
        });
    });

    // NAVIGATION BASES
    document.getElementById("vers-connexion").addEventListener("click", () => {
        blocInscription.style.display = "none"; blocConnexion.style.display = "block";
    });
    document.getElementById("vers-inscription").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocInscription.style.display = "block";
    });
    document.getElementById("vers-oublie").addEventListener("click", () => {
        blocConnexion.style.display = "none"; blocOublie.style.display = "block";
        errOublie.style.display = "none"; succesOublie.style.display = "none"; oubEmail.value = "";
    });
    document.getElementById("oublie-retour").addEventListener("click", () => {
        blocOublie.style.display = "none"; blocConnexion.style.display = "block";
    });

    // SOUMISSION INSCRIPTION
    btnInscription.addEventListener("click", () => {
        errInscription.style.display = "none";
        const t = trad[langueSelectionnee];
        if (insCode.value.trim() === "" || insEmail.value === "" || insPass.value === "") {
            errInscription.textContent = t.errChamps; errInscription.style.display = "block"; return;
        }
        if (insPass.value !== insConf.value) {
            errInscription.textContent = t.errMatchPass; errInscription.style.display = "block"; return;
        }
        
        blocInscription.style.display = "none";
        pop1.style.display = "flex";
        activerAutoScroll(scroller1, btnContp1);
    });

    // CONNEXION
    btnConnexion.addEventListener("click", () => {
        errConnexion.style.display = "none";
        if (conEmail.value === "" || conPass.value === "") {
            errConnexion.textContent = trad[langueSelectionnee].errChamps; errConnexion.style.display = "block"; return;
        }
        blocConnexion.style.display = "none";
        pop1.style.display = "flex";
        activerAutoScroll(scroller1, btnContp1);
    });