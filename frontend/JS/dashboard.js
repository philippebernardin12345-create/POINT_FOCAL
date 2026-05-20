const user = JSON.parse(
    localStorage.getItem('user')
);

const userInfo = document.getElementById('userInfo');

const referralLink = `${window.location.origin}/register.html?ref=${user.invitation_code}`;

userInfo.innerHTML = `
<p>Email: ${user.email}</p>
<p>Code: ${user.invitation_code}</p>
<p>Lien: ${referralLink}</p>
`;

const copyBtn = document.getElementById('copyBtn');

copyBtn.addEventListener('click', async () => {

    await navigator.clipboard.writeText(referralLink);

    alert('Lien copié');
});
