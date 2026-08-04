const videos = [
  ['alQNx0ceCzU', 'Lily Talmers - My Mortal Wound'],
  ['gpFsfQlkiAs', "Lily Talmers - Life's So Fun"],
  ['2GNermXRfW8', 'Lily Talmers - Prayer For Nearly Nothing'],
  ['IR3O3-4_Ubg', 'Lily Talmers - Best of Times'],
  ['9zI8pF6S-RI', 'Eight Carl - Torgo Kills/Torgo Lives'],
  ['hOguQb-k22I', 'waxing away indifference bleeds heartache in a birdsong'],
  ['cSI8bUAfnWI', 'shared flight, silent echoes'],
  ['HVYqS1dICm0', 'my mind is gossamer, my legs are trees'],
  ['O7I9RpXeSaw', "Help! My Roommate's A Monster!"],
  ['3jCfcEKLvU8', 'Color of the Year - Hippie Summer Camp'],
  ['cFcHj81zGs0', 'dust motes in a sunbeam'],
  ['MLAGSNympJ8', 'Sonifying the Thawing Great Lakes'],
  ['41o1Xgtui9I', 'Life After Work'],
  ['c13Fe905lVs', 'Quiet Remains'],
  ['F6bJBp4rzvk', "i'd rather remain in my dreams; at least there i can't think about you; how do i go on from here?"],
  ['xBeVeAeClkU', 'The Security Deposit'],
  ['vXqSd1hKWrs', "The Bada-Ba-Ba-Ba's - sparks"],
  ['mTyq5__0fCI', 'july 16th 2013'],
  ['6-IH3xzIPq0', 'once again'],
  ['yJcetqNbJIE', 'why should you expect to comprehend?'],
  ['fxjCKMlMfek', 'women want me. fish fear me.'],
  ['xC7Pv5TDT9w', 'THE SHOEGAZE SHOW S1E1'],
  ['kHpaVnxLyRI', 'lets just forget about christmas'],
];

const grid = document.querySelector('#video-grid');
const titleBox = document.querySelector('#hover-title');

function setHoverTitle(title) {
  titleBox.textContent = title || 'Hover a frame';
}

function makeThumb([id, title], index) {
  const button = document.createElement('button');
  button.className = 'video-thumb';
  button.type = 'button';
  button.dataset.id = id;
  button.dataset.title = title;
  button.setAttribute('aria-label', `Play ${title}`);

  const img = document.createElement('img');
  img.src = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  img.alt = '';
  img.loading = index < 6 ? 'eager' : 'lazy';

  const label = document.createElement('span');
  label.textContent = title;

  button.append(img, label);
  button.addEventListener('mouseenter', () => setHoverTitle(title));
  button.addEventListener('focus', () => setHoverTitle(title));
  button.addEventListener('mouseleave', () => setHoverTitle(''));
  button.addEventListener('blur', () => setHoverTitle(''));
  button.addEventListener('click', () => activateVideo(button, id, title));

  return button;
}

function activateVideo(node, id, title) {
  const frame = document.createElement('div');
  frame.className = 'crt-frame';
  frame.setAttribute('aria-label', title);

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1`;
  iframe.title = title;
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  iframe.allowFullscreen = true;

  frame.appendChild(iframe);
  node.replaceWith(frame);
  setHoverTitle(title);
}

videos.forEach((video, index) => {
  grid.appendChild(makeThumb(video, index));
});
