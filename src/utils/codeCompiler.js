import axios from "axios";

function toBase64(str) {
    return str ? Buffer.from(str).toString('base64') : '';
}

function fromBase64(str) {
    return str ? Buffer.from(str, 'base64').toString('utf-8') : '';
}

export async function submitCode({ source_code, language_id, stdin }) {
    if (!source_code || !language_id) {
        console.error("source_code or language_id is missing.");
        return {
            stdout: null,
            stderr: "Invalid input: source_code or language_id is missing.",
            status: "error"
        };
    }

    try {
        const submissionResponse = await axios.post(
            'https://judge0-ce.p.rapidapi.com/submissions',
            {
                language_id,
                source_code: toBase64(source_code),
                stdin: toBase64(stdin || '')
            },
            {
                params: {
                    base64_encoded: 'true',
                    wait: 'false',
                    fields: '*'
                },
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': process.env.RAPIDAPI_HOST,
                    'Content-Type': 'application/json'
                }
            }
        );

        const { token } = submissionResponse.data;

        let resultResponse;
        do {
            await new Promise(resolve => setTimeout(resolve, 2000));

            resultResponse = await axios.get(
                `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
                {
                    params: {
                        base64_encoded: 'true',
                        fields: '*'
                    },
                    headers: {
                        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                        'x-rapidapi-host': process.env.RAPIDAPI_HOST
                    }
                }
            );

        } while (resultResponse.data.status.id <= 2);

        const stdout = resultResponse.data.stdout ? fromBase64(resultResponse.data.stdout) : null;
        const stderr = resultResponse.data.stderr ? fromBase64(resultResponse.data.stderr) : null;

        return {
            stdout,
            stderr,
            status: resultResponse.data.status.description
        };

    } catch (error) {
        console.error('Error during code submission:', error.message);
        return {
            stdout: null,
            stderr: error.message,
            status: "error"
        };
    }
}
