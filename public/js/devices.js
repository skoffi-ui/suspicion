// Recherche en temps réel
let searchTimeout;

function setupSearch() {
  const searchInput = document.getElementById('deviceSearch');
  const devicesList = document.getElementById('devicesList');
  const loadingIndicator = document.getElementById('searchLoading');

  if (!searchInput) return;

  searchInput.addEventListener('input', function(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();

    // Afficher l'indicateur de chargement
    if (loadingIndicator) {
      loadingIndicator.style.display = 'block';
    }

    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, 300);
  });

  async function performSearch(query) {
    try {
      const response = await fetch(`/devices/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (devicesList) {
        renderDevicesList(data.devices);
      }

      // Mettre à jour le compteur
      const resultCount = document.getElementById('resultCount');
      if (resultCount) {
        resultCount.textContent = `${data.total} résultat${data.total > 1 ? 's' : ''}`;
      }

    } catch (error) {
      console.error('Search error:', error);
      if (devicesList) {
        devicesList.innerHTML = '<div class="no-results">Erreur lors de la recherche</div>';
      }
    } finally {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }
  }

  function renderDevicesList(devices) {
    if (!devicesList) return;

    if (devices.length === 0) {
      devicesList.innerHTML = '<div class="no-results">Aucun véhicule trouvé</div>';
      return;
    }

    devicesList.innerHTML = devices.map(device => `
      <a href="/devices/${device.device_id}" class="device-item">
        <h4>${device.device_name || 'Sans nom'}</h4>
        <small>ID: ${device.device_id} | Dernière mise à jour: ${formatDate(device.server_time)}</small>
      </a>
    `).join('');
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
  setupSearch();
});