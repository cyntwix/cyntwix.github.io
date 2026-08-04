const address = [97, 100, 97, 109, 115, 105, 105, 115, 109, 101, 116, 115, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109]
  .map((code) => String.fromCharCode(code))
  .join('');

document.getElementById('transmissionLink').addEventListener('click', (event) => {
  event.preventDefault();
  window.location.href = `mailto:${address}`;
});
