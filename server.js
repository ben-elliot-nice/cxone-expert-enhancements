const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuration - Update these with your actual credentials
const CONFIG = {
    baseUrl: 'https://help.benelliot-nice.com',
    cssEditorPath: '/deki/cp/custom_css.php?params=%2F',
    cookies: {
        authtoken: '***REMOVED***',
        mtwebsession: '6a177e120b810f25a448c78def371d54',
        dekisession: '***REMOVED***'
    }
};

app.use(express.json());
app.use(express.static(__dirname));

// Helper function to create cookie header
function getCookieHeader() {
    return `authtoken="${CONFIG.cookies.authtoken}"; mtwebsession=${CONFIG.cookies.mtwebsession}; dekisession="${CONFIG.cookies.dekisession}"`;
}

// Helper function to parse HTML and extract CSS fields
function parseHTML(html) {
    const $ = cheerio.load(html);
    const cssData = {
        csrf_token: '',
        css: {
            all: '',
            anonymous: '',
            viewer: '',
            seated: '',
            admin: '',
            grape: ''
        }
    };

    // Extract CSRF token
    const csrfInput = $('input[name="csrf_token"]');
    if (csrfInput.length) {
        cssData.csrf_token = csrfInput.val();
    }

    // Extract CSS from textareas
    const textareas = {
        'css_template_all': 'all',
        'css_template_anonymous': 'anonymous',
        'css_template_viewer': 'viewer',
        'css_template_seated': 'seated',
        'css_template_admin': 'admin',
        'css_template_grape': 'grape'
    };

    Object.entries(textareas).forEach(([name, key]) => {
        const textarea = $(`textarea[name="${name}"]`);
        if (textarea.length) {
            cssData.css[key] = textarea.text();
        }
    });

    return cssData;
}

// Helper function to build multipart form data
function buildMultipartBody(cssData) {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    let body = '';

    // Add CSRF token
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="csrf_token"\r\n\r\n`;
    body += `${cssData.csrf_token}\r\n`;

    // Add CSS templates
    const fields = {
        'css_template_all': cssData.css_template_all,
        'css_template_anonymous': cssData.css_template_anonymous,
        'css_template_viewer': cssData.css_template_viewer,
        'css_template_seated': cssData.css_template_seated,
        'css_template_admin': cssData.css_template_admin,
        'css_template_grape': cssData.css_template_grape
    };

    Object.entries(fields).forEach(([name, value]) => {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
        body += `${value}\r\n`;
    });

    // Add submit button
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="deki_buttons[submit][submit]"\r\n\r\n`;
    body += `submit\r\n`;
    body += `--${boundary}--\r\n`;

    return { body, boundary };
}

// GET endpoint to fetch CSS from legacy page
app.get('/api/css', async (req, res) => {
    try {
        const response = await axios.get(CONFIG.baseUrl + CONFIG.cssEditorPath, {
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'max-age=0',
                'Cookie': getCookieHeader(),
                'DNT': '1',
                'Referer': CONFIG.baseUrl + CONFIG.cssEditorPath,
                'Sec-CH-UA': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
            }
        });

        const parsedData = parseHTML(response.data);

        res.json({
            success: true,
            ...parsedData
        });
    } catch (error) {
        console.error('Error fetching CSS:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST endpoint to save CSS to legacy page
app.post('/api/css', async (req, res) => {
    try {
        const cssData = req.body;
        const { body, boundary } = buildMultipartBody(cssData);

        const response = await axios.post(
            CONFIG.baseUrl + CONFIG.cssEditorPath,
            body,
            {
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'max-age=0',
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Cookie': getCookieHeader(),
                    'DNT': '1',
                    'Origin': CONFIG.baseUrl,
                    'Referer': CONFIG.baseUrl + CONFIG.cssEditorPath,
                    'Sec-CH-UA': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
                    'Sec-CH-UA-Mobile': '?0',
                    'Sec-CH-UA-Platform': '"Windows"',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Accept 2xx and 3xx status codes
                }
            }
        );

        // Check if we got a successful response or redirect
        if (response.status === 302 || response.status === 200) {
            res.json({
                success: true,
                message: 'CSS saved successfully'
            });
        } else {
            throw new Error(`Unexpected response status: ${response.status}`);
        }
    } catch (error) {
        console.error('Error saving CSS:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🎨 CXone Expert CSS Editor running at http://localhost:${PORT}`);
    console.log(`\nOpen your browser to: http://localhost:${PORT}\n`);
});
