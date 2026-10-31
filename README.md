# Hisar Fitness Club — Gym Management App — enhanced version

Static frontend for GitHub Pages using Firebase Authentication and Cloud Firestore.

## Included features
- Admin email/password login
- Member management, plan dates, and manual renewal button
- Expiry dashboard and prefilled WhatsApp reminder links
- Daily attendance check-in (one check-in per member per day in normal UI flow)
- Monthly income and expense report, CSV export
- Gym name, tagline, and optional logo URL customization
- Responsive design and INR currency display

## 1. Configure Firebase
1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Add a web app and copy its config.
3. Enable Authentication → Sign-in method → Email/Password.
4. Create your admin user in Authentication → Users.
5. Create a Cloud Firestore database.
6. Replace the placeholder values in `app.js` under `firebaseConfig`.
7. Publish the rules from `firestore.rules` as a starting point.

**Security:** The included rules allow any signed-in user to read/write the database. Restrict production access to known admin UIDs/custom claims before adding real member data. Never put service-account keys in frontend code.

## 2. Customize gym branding
In `app.js`, edit:
```js
const GYM_BRAND = {
  name: "Hisar Fitness Club",
  tagline: "FITNESS • STRENGTH • COMMUNITY",
  logoUrl: ""
};
```
Set `name` and `tagline`. For `logoUrl`, use a publicly accessible image URL (or a URL hosted in the same GitHub repository, e.g. `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/logo.png`). For easiest setup, put `logo.png` in the repository root and use the corresponding full URL. Use an image you own or have permission to use.

## 3. Publish with GitHub Pages
1. Create a repository such as `gym-management-app`.
2. Upload `index.html`, `style.css`, `app.js`, `firestore.rules`, `.nojekyll`, and `README.md` to the root.
3. Open Settings → Pages → Deploy from a branch.
4. Choose branch `main` and folder `/(root)`, then save.
5. Your app will be published at `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`.

## 4. Local preview
Run `python -m http.server 8000` in the project folder and open `http://localhost:8000/`. ES modules may not work from a `file://` URL.

## Firestore collections
- `members/{id}`: name, phone, email, plan, startDate, expiryDate, fee, notes, createdAt, updatedAt
- `payments/{id}`: memberId, memberName, amount, paymentDate, method, note, createdAt
- `expenses/{id}`: category, description, amount, expenseDate, createdAt
- `attendance/{id}`: memberId, memberName, date, time, note, checkedInAt

## Important behavior / limitations
- Renewal button updates membership dates and adds a payment record labelled “Pending confirmation”. Confirm the fee is actually received and correct the payment record before treating it as collected. For stricter bookkeeping, use a separate renewal flow that only creates payment after confirmation.
- Expiry reminders are dashboard-generated. WhatsApp links open prefilled messages and require a staff member to press Send. Automatic scheduled messages require a backend (for example Firebase Cloud Functions) and a messaging provider.
- Daily check-in prevents duplicate check-ins in the normal app UI, but production rules/server logic should also enforce this against concurrent or malicious writes.
- Reports use payment and expense dates and are only as accurate as the records entered.


## Branding
This version is preconfigured with the **Hisar Fitness Club** name and the supplied logo at `assets/hisarfitnessclublogo.jpg`. To change the branding later, edit the `GYM_BRAND` constant near the top of `app.js`.
