const root = document.documentElement;
const motif = document.querySelector('.oracle-stage');

window.addEventListener('pointermove', (event) => {
  const x = (event.clientX / window.innerWidth - 0.5).toFixed(3);
  const y = (event.clientY / window.innerHeight - 0.5).toFixed(3);
  root.style.setProperty('--pointer-x', x);
  root.style.setProperty('--pointer-y', y);

  if (motif) {
    motif.style.transform = `translate(${Number(x) * 8}px, ${Number(y) * 8}px)`;
  }
});
