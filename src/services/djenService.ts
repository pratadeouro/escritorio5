
export const searchDatajud = async (query: any, tribunal: string = 'tjam') => {
  const url = `/api/datajud/search?tribunal=${tribunal.toLowerCase()}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || `Erro ao buscar processo: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na busca Datajud:', error);
    throw error;
  }
};
