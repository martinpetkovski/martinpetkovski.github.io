const fetch = require('node-fetch');
const crypto = require('crypto');

exports.handler = async (event) => {
    try {
        const { data, type, bandId, captchaToken } = JSON.parse(event.body);
        const clientIp = event.headers['client-ip'] || 'unknown';
        const token = process.env.GITHUB_TOKEN;
        const hCaptchaSecret = process.env.HCAPTCHA_SECRET;
        const repo = 'martinpetkovski/martinpetkovski.github.io';
        const pendingPath = 'masterlista/pending-edits.json';

        // Verify CAPTCHA
        const captchaResponse = await fetch('https://hcaptcha.com/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `response=${captchaToken}&secret=${hCaptchaSecret}`
        });
        const captchaResult = await captchaResponse.json();
        if (!captchaResult.success) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'CAPTCHA verification failed' })
            };
        }

        // Fetch pending-edits.json
        const pendingUrl = `https://api.github.com/repos/${repo}/contents/${pendingPath}`;
        const getResponse = await fetch(pendingUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        const fileData = await getResponse.json();
        const pendingEdits = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8')) || [];

        // Rate limiting: Check if user submitted in the last minute
        const hashedIp = crypto.createHash('sha256').update(clientIp).digest('hex');
        const recentSubmission = pendingEdits.find(
            edit =>
                edit.submitterIp === hashedIp &&
                new Date().getTime() - new Date(edit.submittedAt).getTime() < 60 * 1000
        );
        if (recentSubmission) {
            return {
                statusCode: 429,
                body: JSON.stringify({ error: 'Please wait 1 minute before submitting again' })
            };
        }

        // Validate data
        if (!data || !type || (type === 'edit' && bandId == null)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid submission data' })
            };
        }

        // Add new pending edit
        const newEdit = {
            id: Date.now().toString(),
            type,
            bandId: type === 'edit' ? bandId : null,
            data,
            submittedAt: new Date().toISOString(),
            submitterIp: hashedIp,
            status: 'pending'
        };
        pendingEdits.push(newEdit);

        // Update pending-edits.json
        const updateResponse = await fetch(pendingUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Add pending edit',
                content: Buffer.from(JSON.stringify(pendingEdits, null, 2)).toString('base64'),
                sha: fileData.sha
            })
        });

        if (!updateResponse.ok) {
            throw new Error('Failed to update pending-edits.json');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Submission received, pending admin approval' })
        };
    } catch (error) {
        console.error('Error in submit-edit:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};