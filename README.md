# Lienvo

**Transformez votre téléphone en caméra pour votre ordinateur et envoyez des fichiers entre les deux appareils, directement depuis le navigateur.** Aucun compte ni application à installer n’est nécessaire.

Lienvo est un projet personnel gratuit et open source. Le dépôt contient les conditions d’utilisation, la notice de confidentialité et les mentions légales : [Conditions](public/conditions.html) · [Confidentialité et cookies](public/confidentialite.html) · [Mentions légales](public/mentions-legales.html).

## Fonctionnalités

- Appairage du téléphone et de l’ordinateur par code à six chiffres ou QR code.
- Affichage en direct de la caméra du téléphone sur l’ordinateur.
- Sélection de la caméra avant ou arrière, et commande de la lampe torche lorsque l’appareil le permet.
- Affichage de la vidéo en plein écran sur l’ordinateur.
- Envoi de fichiers du téléphone vers l’ordinateur, jusqu’à **50 Mo par fichier**.
- Interface utilisable sur téléphone et ordinateur, avec thèmes clair et sombre.

## Utilisation

1. Ouvrez Lienvo dans un navigateur récent sur l’ordinateur et laissez la page ouverte.
2. Sur le téléphone, scannez le QR code affiché ou ouvrez la page `/p`, puis saisissez le code.
3. Vérifiez que le téléphone appairé est le bon. Activez la caméra si vous souhaitez l’utiliser et accordez l’autorisation demandée par le navigateur.
4. Pour transférer un fichier, choisissez-le sur le téléphone. Le fichier reçu apparaît sur l’ordinateur pour téléchargement.
5. Fermez les pages sur les deux appareils lorsque vous avez terminé.

Le code est à usage unique et expire après cinq minutes s’il n’est pas utilisé. La caméra ne démarre pas sans action et autorisation de l’utilisateur. Lienvo n’utilise pas le microphone.

## Fonctionnement et limites

L’appairage et les messages nécessaires à la connexion passent par un Worker Cloudflare et un Durable Object. Quand le réseau le permet, le flux vidéo et les fichiers circulent directement entre les navigateurs avec WebRTC. Selon le réseau, un relais peut être nécessaire ; certains réseaux filtrent ou empêchent les connexions. Le service ne peut donc pas garantir le fonctionnement sur tous les appareils ou réseaux.

Lienvo ne crée pas de compte et ne fournit pas de stockage applicatif pour archiver les vidéos ou les fichiers. Le navigateur destinataire peut enregistrer localement les fichiers téléchargés. Cloudflare et, si un relais est utilisé, les fournisseurs réseau peuvent traiter les données techniques nécessaires au fonctionnement. La [notice de confidentialité](public/confidentialite.html) détaille ces traitements. Le code applicatif n’intègre pas de publicité ni de mesure d’audience ; cela ne signifie pas que l’infrastructure d’hébergement ne traite aucune métadonnée technique.

Le code d’appairage donne accès à la session à toute personne qui le connaît pendant sa durée de validité. Ne le partagez qu’avec l’appareil voulu. N’envoyez pas de document sensible à un appareil ou sur un réseau que vous ne contrôlez pas. Pour filmer une personne ou utiliser Lienvo dans un établissement scolaire, obtenez les autorisations nécessaires et respectez les consignes applicables.

## Développement local

Prérequis : Node.js 22 ou une version ultérieure et npm.

```bash
git clone https://github.com/jed-aloui/Lienvo.git
cd Lienvo
npm ci
npm start
```

Le serveur local démarre sur le port `3000` par défaut. Ouvrez `http://localhost:3000` sur l’ordinateur. Pour utiliser la caméra depuis un autre appareil, le navigateur du téléphone exige généralement un contexte HTTPS ; configurez un tunnel ou un environnement HTTPS adapté et ne rendez pas le serveur public sans en comprendre les conséquences.

Si un réseau nécessite un serveur TURN, le serveur Node local accepte les variables d’environnement `TURN_URL`, `TURN_USER` et `TURN_PASS`. `TURN_URL` peut contenir plusieurs adresses séparées par des virgules. Ne placez jamais de mots de passe ou de jetons dans le dépôt Git.

## Déploiement Cloudflare Workers

Le dépôt contient `wrangler.toml`, le Worker dans `src/worker.js` et les fichiers statiques dans `public/`. Le Worker utilise les assets Cloudflare et le Durable Object `Hub` pour l’appairage et la signalisation.

Pour une prévisualisation locale du Worker :

```bash
npx wrangler dev
```

Pour déployer avec Wrangler, configurez d’abord l’authentification Cloudflare, puis vérifiez dans le tableau de bord que le Worker cible est bien `lienvo` et que le binding Durable Object `HUB` est configuré correctement :

```bash
npx wrangler deploy
```

Les identifiants TURN Cloudflare éventuels doivent être enregistrés comme secrets ou variables dans Cloudflare, jamais dans un fichier public. Un push sur une branche de production reliée à Workers Builds peut lancer un déploiement automatique : vérifiez la branche et la configuration du projet avant de pousser.

## Structure du dépôt

```text
public/                  Pages HTML, styles, thème et fond d’écran
  index.html             Interface ordinateur
  phone.html             Interface téléphone
  conditions.html        Conditions générales d’utilisation
  confidentialite.html   Notice de confidentialité et cookies
  mentions-legales.html  Mentions légales
src/worker.js            Worker Cloudflare et classe Durable Object Hub
server.js                Serveur Node.js pour le développement local
wrangler.toml            Configuration Wrangler et binding Durable Object
```

Certains fichiers d’interface portent encore un nom historique `hublot` dans leur chemin. Ces noms sont conservés parce qu’ils sont référencés par les pages ; le nom de marque affiché est **Lienvo**.

## Signaler un problème

Pour signaler un bug ou proposer une amélioration, ouvrez une [issue GitHub](https://github.com/jed-aloui/Lienvo/issues). Ne publiez pas de code d’appairage, de données personnelles, de fichiers confidentiels ou de jetons d’accès dans une issue.

## Licence

Lienvo est publié sous licence [MIT](LICENSE). Consultez le fichier de licence pour les conditions exactes.
