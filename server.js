const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // node-fetch@2
const pug = require('pug');
const showdown = require('showdown');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
console.log(TOKEN);
const FILE_PATH = 'index.md';
const HTML_PATH = 'index.html';
const PAGES_DIR = 'pages';

if (!fs.existsSync(PAGES_DIR)) {
    fs.mkdirSync(PAGES_DIR);
}

const userFormats = {};
const userHeadings = {};

function getNextFileNumber() {
    let number = 1;
    while (fs.existsSync(path.join(PAGES_DIR, `page${number}.html`))) {
        number++;
    }
    return number;
}

function saveText(userId, text) {
    const formatting = userFormats[userId] || '';
    const heading = userHeadings[userId] || '';
    const formattedText = `${heading}${formatting}${text}${formatting.split('').reverse().join('')} \n`;
    console.log('message sent');
    fs.appendFileSync(FILE_PATH, formattedText, 'utf-8');
    userFormats[userId] = '';
    userHeadings[userId] = '';
}

function saveMedia(fileLink, mediaType) {
    let mediaReference = '';
    if (mediaType === 'photo') {
        mediaReference = `![Photo](${fileLink})\n`;
    } else if (mediaType === 'video') {
        mediaReference = `![Video](${fileLink})\n`;
    } else if (mediaType === 'gif') {
        mediaReference = `![GIF](${fileLink})\n`;
    }

    fs.appendFileSync(FILE_PATH, mediaReference, 'utf-8');
    console.log(`${mediaType} sent`);
}

// commands
const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/strikethrough/, (msg) => {
    const userId = msg.from.id;
    userFormats[userId] = '~~' + (userFormats[userId] || '');
});

bot.onText(/\/italic/, (msg) => {
    const userId = msg.from.id;
    userFormats[userId] = '_' + (userFormats[userId] || '');
});

bot.onText(/\/bold/, (msg) => {
    const userId = msg.from.id;
    userFormats[userId] = '**' + (userFormats[userId] || '');
});

bot.onText(/\/title/, (msg) => {
    const userId = msg.from.id;
    userHeadings[userId] = '# ' + (userHeadings[userId] || '');
});

bot.onText(/\/subtitle/, (msg) => {
    const userId = msg.from.id;
    userHeadings[userId] = '## ' + (userHeadings[userId] || '');
});

bot.onText(/\/heading1/, (msg) => {
    const userId = msg.from.id;
    userHeadings[userId] = '### ' + (userHeadings[userId] || '');
});

bot.onText(/\/heading2/, (msg) => {
    const userId = msg.from.id;
    userHeadings[userId] = '#### ' + (userHeadings[userId] || '');
});

bot.onText(/\/newline/, (msg) => {
    fs.appendFileSync(FILE_PATH, '\n', 'utf-8');
});

bot.onText(/\/save/, (msg) => {
    const chatId = msg.chat.id;

    const mdContent = fs.readFileSync(FILE_PATH, 'utf-8');

    const converter = new showdown.Converter();
    const htmlContent = converter.makeHtml(mdContent);

    const htmlTemplate = pug.renderFile('template.pug', { content: htmlContent });

    const fileNumber = getNextFileNumber();
    const htmlFileName = `page${fileNumber}.html`;
    const htmlFilePath = path.join(PAGES_DIR, htmlFileName);
    fs.writeFileSync(htmlFilePath, htmlTemplate, 'utf-8');

    bot.sendMessage(chatId, `Here is the content of the Markdown file:\n\n${mdContent}`).then(() => {
        bot.sendDocument(chatId, htmlFilePath).then(() => {
            fs.writeFileSync(FILE_PATH, '', 'utf-8');
            fs.writeFileSync(HTML_PATH, '', 'utf-8');

            bot.sendMessage(chatId, `Markdown content sent as text. HTML file has been saved as ${htmlFileName} and sent. Both files have been cleared.`);
        }).catch(err => {
            bot.sendMessage(chatId, 'Failed to send HTML file.');
            console.error('Error sending HTML file:', err);
        });
    }).catch(err => {
        bot.sendMessage(chatId, 'Failed to send Markdown content as text.');
        console.error('Error sending Markdown content:', err);
    });
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (msg.text && !msg.text.startsWith('/')) {
        saveText(userId, msg.text);
    } else if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id;
        const fileLink = await getFileLink(fileId, TOKEN);
        if (fileLink) {
            saveMedia(fileLink, 'photo');
        }
    } else if (msg.video) {
        const fileId = msg.video.file_id;
        const fileLink = await getFileLink(fileId, TOKEN);
        if (fileLink) {
            saveMedia(fileLink, 'video');
        }
    } else if (msg.animation) {
        const fileId = msg.animation.file_id;
        const fileLink = await getFileLink(fileId, TOKEN);
        if (fileLink) {
            saveMedia(fileLink, 'gif');
        }
    }
});

async function getFileLink(fileId, botToken) {
    const apiUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.ok) {
            const filePath = data.result.file_path;
            const fileLink = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
            return fileLink;
        } else {
            console.error("Failed to get file path:", data.description);
        }
    } catch (error) {
        console.error("Error fetching file link:", error);
    }
}

console.log('Bot is running...');
