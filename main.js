const { firefox } = require('playwright');
const axios = require('axios');
const fs = require('fs');

function randomstring(L) {
    let s = ''; //from stackoverflow :pepe:
    let randomchar = function() {
        let n = Math.floor(Math.random() * 62);
        if (n < 10) return n; //1-10
        if (n < 36) return String.fromCharCode(n + 55); //A-Z
        return String.fromCharCode(n + 61); //a-z
    }
    while (s.length < L) s += randomchar();
    return s;
}

class Mail {
    constructor(email) {
        this.email = email
    }

    wait_for_mail(subject) {
        return new Promise(async(resolve) => {
            const { data } = await axios({
                url: 'https://api.xitroo.com/v1/mails',
                params: {
                    locale: 'en',
                    mailAddress: this.email,
                    mailsPerPage: 25,
                    minTimestamp: 0,
                    maxTimestamp: new Date().getTime() / 1000,
                }
            })

            if(data.type == 'empty response'){
                return setTimeout(() => this.wait_for_mail(subject).then((res) => resolve(res)), 1000);
            }

            let subjects = data.mails.filter((x) => Buffer.from(x.subject, 'base64').toString('utf-8').includes(subject))

            if(subjects.length <= 0 || !subjects) return setTimeout(() => this.wait_for_mail(subject).then((res) => resolve(res)), 1000);

            subjects = subjects[0]

            const id = subjects._id;

            (async function GrabContents() {
                const { data } = await axios({
                    url: 'https://api.xitroo.com/v1/mail',
                    params: {
                        locale: 'en',
                        id: id,
                    }
                })

                data.bodyText = Buffer.from(data.bodyText, 'base64').toString('utf-8')
                data.bodyHtml = Buffer.from(data.bodyHtml, 'base64').toString('utf-8')
                data.bodyHtmlStrict = Buffer.from(data.bodyHtmlStrict, 'base64').toString('utf-8')

                resolve(data)
            })()
        })
    }
}

console.clear()
let to = 3000;
(async() => {
    for(let i = 0; i < 1; i++) {
        await new Promise(resolve => setTimeout(resolve, to));
        to += 3000
        Gen()
    }
})();

let count = 0

async function Gen() {
    const browser = await firefox.launch({
        headless: false
    });

    const page = await browser.newPage();

    await page.goto('https://www.toweroffantasy-global.com/', { waitUntil: 'networkidle' });
  
    await page.click('[lang="loginText"]')
    await page.click('[lang="registerNow"]')

    const email = `${randomstring(15)}@xitroo.com`
    const password = randomstring(16)
    
    await page.evaluate(() => {
        document.querySelector('[id="onetrust-accept-btn-handler"]').click()
        document.querySelector('[id="registerPrivacyAgreement"]').click()
    })
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.type('//*[@id="container"]/div[1]/div[12]/div/div[2]/input', email)

    await page.click('[lang="sendVerifiyCode"]')
    await page.type('//*[@id="container"]/div[1]/div[12]/div/div[3]/div[1]/input', password)
    await new Promise(resolve => setTimeout(resolve, 250));
    await page.type('//*[@id="container"]/div[1]/div[12]/div/div[3]/div[2]/input', password)

    const mclient = new Mail(email)
    const mail = await mclient.wait_for_mail('Tower of Fantasy')

    const code = mail.bodyHtml.split('<font size="6" color="#6B86BE">')[1].split('</font>')[0].trim()

    await page.type('[lang="enterVerifiyCode"]', code)


    await new Promise(resolve => setTimeout(resolve, 3500));
    await page.evaluate(() => {
        document.querySelector('[lang="registerAndLogin"]').click()
    })

    page.on('response', async(req) => {
        if(req.url().includes('auth/login')) {
            const data = await req.json()
            LoginByINTL(data)
        }
    })

    async function LoginByINTL(data) {
        const login = await axios({
            url: 'https://na-community.playerinfinite.com/api/trpc/trpc.wegame_app_global.auth_svr.AuthSvr/LoginByINTL',
            method: 'POST',
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.81 Safari/537.36',
                'content-type': 'application/json',
            },
            data: {
                mappid: 10109,
                clienttype: 903,
                login_info: {
                    game_id: '29093',
                    open_id: data.openid,
                    token: data.token,
                    channel_id: data.channel_info.account_plat_type,
                    channel_info: String({
                        account_plat_type: data.channel_info.account_plat_type,
                        expire_ts: data.channel_info.expire_ts,
                        token: data.channel_info.token 
                    })
                }
            }
        })
    
        const info = login.data;

        (async function Obtain() {
            const req = await axios({
                url: 'https://www.jupiterlauncher.com/api/v1/fleet.platform.game.GameCommunity/ObtainCdkey',
                method: 'POST',
                headers: {
                    referer: 'https://www.toweroffantasy-global.com/',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.81 Safari/537.36',
                    'content-type': 'application/json',
                },
                data: {
                    cookies: `uid=${info.data.user_id};ticket=${info.data.wt}`
                }
            })

            const promo = req.data

            const link = promo.cdkey
            fs.appendFileSync('codes.txt', link + '\n')
            console.log(link, count+1)
            count += 1
            browser.close()
            Gen()
        })()
    }
}
