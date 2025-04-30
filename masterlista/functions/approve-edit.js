const fetch = require('node-fetch');

exports.handler = async (event) => {
    try {
        const { editId, action } = JSON.parse(event.body); // action: 'approve' or 'reject'
        const adminSecret = event.headers['x-admin-secret']; // Simple admin authentication
        const token = process.env.GITHUB_TOKEN;
        const repo = 'martinpetkovski/martinpetkovski.github.io';
        const pendingPath = 'masterlista/pending-edits.json';
        const bandsPath = 'masterlista/bands.json';

        // Verify admin secret
        if (adminSecret !== process.env.ADMIN_SECRET) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }

        // Fetch pending-edits.json
        const pendingUrl = `https://api.github.com/repos/${repo}/contents/${pendingPath}`;
        const pendingResponse = await fetch(pendingUrl, {
            headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        const pendingFile = await pendingResponse.json();
        const pendingEdits = JSON.parse(Buffer.from(pendingFile.content, 'base64').toString('utf8'));

        // Find edit
        const edit = pendingEdits.find(e => e.id === editId);
        if (!edit) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Edit not found' })
            };
        }

        // Update edit status
        edit.status = action;

        // If approved, update bands.json
        if (action === 'approve') {
            const bandsUrl = `https://api.github.com/repos/${repo}/contents/${bandsPath}`;
            const bandsResponse = await fetch(bandsUrl, {
                headers: { Authorization: `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' }
            });
            const bandsFile = await bandsResponse.json();
            const bandsData = JSON.parse(Buffer.from(bandsFile.content, 'base64').toString('utf8'));

            if (edit.type === 'edit') {
                bandsData.muzickaMasterLista[parseInt(edit.bandId)] = edit.data;
            } else if (edit.type === 'add') {
                bandsData.muzickaMasterLista.push(edit.data);
            }

            // Update bands.json
            await fetch(bandsUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Apply edit ${editId}`,
                    content: Buffer.from(JSON.stringify(bandsData, null, 2)).toString('base64'),
                    sha: bandsFile.sha
                })
            });
        }

        // Update pending-edits.json
        await fetch(pendingUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update edit ${editId} status to ${action}`,
                content: Buffer.from(JSON.stringify(pendingEdits, null, 2)).toString('base64'),
                sha: pendingFile.sha
            })
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ message: `Edit ${action} successfully` })
        };
    } catch (error) {
        console.error('Error in approve-edit:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};