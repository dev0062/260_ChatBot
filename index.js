const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.redirect('index.html');
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: 'Messages harus berupa array'
            });
        }

        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gemini-3.5-flash-lite',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: true
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();

            console.error('Error from Gemini API:', errorData);

            return res.status(response.status).json({
                error: errorData
            });
        }

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({ error: 'Terjadi kesalahan pada server' });
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});



