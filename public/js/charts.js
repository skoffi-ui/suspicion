// Configuration des graphiques avec Chart.js
function initCharts(speedData, powerData) {
  // Graphique de vitesse
  const speedCtx = document.getElementById('speedChart')?.getContext('2d');
  if (speedCtx && speedData && speedData.length > 0) {
    new Chart(speedCtx, {
      type: 'line',
      data: {
        labels: speedData.map(d => new Date(d.server_time).toLocaleTimeString()),
        datasets: [{
          label: 'Vitesse (km/h)',
          data: speedData.map(d => d.speed),
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Vitesse (km/h)'
            }
          }
        }
      }
    });
  }

  // Graphique de puissance
  const powerCtx = document.getElementById('powerChart')?.getContext('2d');
  if (powerCtx && powerData && powerData.length > 0) {
    new Chart(powerCtx, {
      type: 'line',
      data: {
        labels: powerData.map(d => new Date(d.server_time).toLocaleTimeString()),
        datasets: [{
          label: 'Puissance',
          data: powerData.map(d => d.power),
          borderColor: '#e74c3c',
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Puissance'
            }
          }
        }
      }
    });
  }
}