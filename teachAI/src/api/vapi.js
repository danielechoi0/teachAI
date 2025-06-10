export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export async function startCall({ assistantId, studentName, studentNumber }) {
  const response = await fetch(`${BACKEND_URL}/start-call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId,
      studentName,
      studentNumber
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start call');
  }

  return response.json();
}

export const fetchAssistants = async (studentKey) => {
  try {
    if (!studentKey) {
      throw new Error('Student key is required');
    }
    console.log("Fetching from:", `${BACKEND_URL}/assistants/by-key/${studentKey}`);

    const response = await fetch(`${BACKEND_URL}/assistants/by-key/${studentKey}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch assistants' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching assistants:', error);
    throw error;
  }
};