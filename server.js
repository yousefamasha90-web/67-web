const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// الصفحة الرئيسية (UI)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>لوحة سيرفرات ديسكورد</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-900 text-white min-h-screen flex flex-col items-center p-6">
        <div class="max-w-4xl w-full bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
            <h1 class="text-3xl font-bold text-center mb-6 text-indigo-400">لوحة تحكم سيرفرات Discord الخاصة بك</h1>
            
            <div id="login-section" class="text-center py-10">
                <p class="text-gray-400 mb-6">قم بتسجيل الدخول بعرض جميع السيرفرات التي تملك فيها صلاحية المالك (Ownership).</p>
                <a href="/login" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition duration-300 shadow-lg inline-block">
                    تسجيل الدخول باستخدام Discord
                </a>
            </div>

            <div id="dashboard" class="hidden">
                <div id="user-info" class="flex items-center space-x-4 space-x-reverse bg-gray-700/50 p-4 rounded-xl mb-8 border border-gray-600">
                    <img id="avatar" class="w-16 h-16 rounded-full border-2 border-indigo-500" src="" alt="Avatar">
                    <div>
                        <h2 id="username" class="text-xl font-bold"></h2>
                        <p id="user-id" class="text-sm text-gray-400"></p>
                    </div>
                </div>

                <h3 class="text-2xl font-bold mb-4 text-indigo-300">السيرفرات التي تملكها:</h3>
                <div id="guilds-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- يتم عرض السيرفرات هنا -->
                </div>
            </div>
        </div>

        <script>
            // التعديل والمتابعة من الرابط
            const urlParams = new URLSearchParams(window.location.search);
            const dataParam = urlParams.get('data');

            if (dataParam) {
                try {
                    const data = JSON.parse(decodeURIComponent(dataParam));
                    document.getElementById('login-section').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');

                    // عرض بيانات المستخدم
                    document.getElementById('username').innerText = data.user.username;
                    document.getElementById('user-id').innerText = 'ID: ' + data.user.id;
                    const avatarUrl = data.user.avatar 
                        ? \`https://cdn.discordapp.com/avatars/\${data.user.id}/\${data.user.avatar}.png\`
                        : 'https://cdn.discordapp.com/embed/avatars/0.png';
                    document.getElementById('avatar').src = avatarUrl;

                    // عرض السيرفرات
                    const grid = document.getElementById('guilds-grid');
                    grid.innerHTML = '';
                    if (data.ownedGuilds.length === 0) {
                        grid.innerHTML = '<p class="text-gray-400 col-span-full text-center">لا يوجد سيرفرات تملكها بحسابك.</p>';
                    } else {
                        data.ownedGuilds.forEach(guild => {
                            const iconUrl = guild.icon 
                                ? \`https://cdn.discordapp.com/icons/\${guild.id}/\${guild.icon}.png\`
                                : 'https://cdn.discordapp.com/embed/avatars/1.png';

                            const card = document.createElement('div');
                            card.className = 'bg-gray-700 p-4 rounded-xl flex items-center space-x-4 space-x-reverse border border-gray-600 hover:border-indigo-500 transition';
                            card.innerHTML = \`
                                <img src="\${iconUrl}" class="w-12 h-12 rounded-full border border-gray-500">
                                <div class="overflow-hidden">
                                    <h4 class="font-bold truncate">\${guild.name}</h4>
                                    <p class="text-xs text-gray-400">ID: \${guild.id}</p>
                                    <span class="inline-block mt-1 bg-green-900/50 text-green-400 text-xs px-2 py-0.5 rounded border border-green-700">Owner</span>
                                </div>
                            \`;
                            grid.appendChild(card);
                        });
                    }
                } catch(e) { console.error(e); }
            }
        </script>
    </body>
    </html>
    `);
});

// توجيه المستخدم لصفحة ديسكورد
app.get('/login', (req, res) => {
    const discordUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(discordUrl);
});

// استقبال الـ Callback بعد موافقة المستخدم
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('خطأ: لم يتم إرسال الكود');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        // جلب بيانات المستخدم
        const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // جلب سيرفرات المستخدم
        const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        // فلترة السيرفرات وتحديد التي يملكها فقط
        const ownedGuilds = guildsRes.data.filter(g => g.owner === true);

        const responseData = encodeURIComponent(JSON.stringify({
            user: userRes.data,
            ownedGuilds: ownedGuilds
        }));

        res.redirect(`/?data=${responseData}`);

    } catch (err) {
        console.error(err.response?.data || err.message);
        res.status(500).send('فشل الاتصال بـ Discord API');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الموقع شغال على البورت ${PORT}`));
