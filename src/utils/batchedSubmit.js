import axios from "axios";

function toBase64(str) {
    return str ? Buffer.from(str).toString("base64") : "";
}

function fromBase64(str) {
    return str ? Buffer.from(str, "base64").toString("utf-8") : "";
}

export async function submitBatchedCode(submissions) {
    if (!submissions || !Array.isArray(submissions) || submissions.length === 0) {
        throw new Error("Invalid submissions: An array of submissions is required.");
    }

    try {
        const response = await axios.post(
            "https://judge0-ce.p.rapidapi.com/submissions/batch",
            { submissions: submissions.map(sub => ({
                language_id: sub.language_id,
                source_code: toBase64(sub.source_code),
                stdin: toBase64(sub.stdin || ""),
            })) },
            {
                params: {
                    base64_encoded: "true",
                    wait: "false",
                },
                headers: {
                    "x-rapidapi-key": process.env.RAPIDAPI_KEY,
                    "x-rapidapi-host": process.env.RAPIDAPI_HOST,
                    "Content-Type": "application/json",
                },
            }
        );

        const tokens = response.data;

        const results = await Promise.all(
            tokens.map(async ({ token }) => {
                let result;
                do {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const resultResponse = await axios.get(
                        `https://judge0-ce.p.rapidapi.com/submissions/${token}`,
                        {
                            params: {
                                base64_encoded: "true",
                            },
                            headers: {
                                "x-rapidapi-key": process.env.RAPIDAPI_KEY,
                                "x-rapidapi-host": process.env.RAPIDAPI_HOST,
                            },
                        }
                    );
                    result = resultResponse.data;
                } while (result.status.id <= 2);

                return {
                    stdout: result.stdout ? fromBase64(result.stdout) : null,
                    stderr: result.stderr ? fromBase64(result.stderr) : null,
                    status: result.status.description,
                };
            })
        );

        return results;
    } catch (error) {
        console.error("Error during batched code submission:", error.message);
        throw new Error(error.message);
    }
}
