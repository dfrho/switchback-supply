export type ProductArtKind = 'pack' | 'boot' | 'shell' | 'headlamp' | 'poles' | 'filter';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  blurb: string;
  art: ProductArtKind;
  tone: string;
}

/** Fictional catalog for the Switchback Supply demo storefront. */
export const PRODUCTS: Product[] = [
  {
    id: 'ridgeline-45',
    name: 'Ridgeline 45 Pack',
    category: 'Packs',
    price: 219,
    blurb: 'Framed 45 L pack with a load-lifting hipbelt for long ridge days.',
    art: 'pack',
    tone: '#c9d8c5',
  },
  {
    id: 'talus-mid',
    name: 'Talus Mid Boot',
    category: 'Footwear',
    price: 189,
    blurb: 'Waterproof mid hiker with a rock plate and a grippy lug sole.',
    art: 'boot',
    tone: '#e8cfb4',
  },
  {
    id: 'squall-shell',
    name: 'Squall 3L Shell',
    category: 'Outerwear',
    price: 279,
    blurb: 'Three-layer storm shell with pit zips and a helmet-ready hood.',
    art: 'shell',
    tone: '#bfd3dd',
  },
  {
    id: 'alpenglow-400',
    name: 'Alpenglow 400 Headlamp',
    category: 'Lighting',
    price: 54,
    blurb: '400 lumen rechargeable headlamp with a red night mode.',
    art: 'headlamp',
    tone: '#efe0a8',
  },
  {
    id: 'cairn-poles',
    name: 'Cairn Expanding Carbon Poles',
    category: 'Trekking',
    price: 149,
    blurb: 'Expanding three-section carbon poles that adjust from 100 to 135 cm, with cork grips. 480 g per pair.',
    art: 'poles',
    tone: '#d6cde3',
  },
  {
    id: 'spring-filter',
    name: 'Springline Filter',
    category: 'Water',
    price: 42,
    blurb: 'Squeeze filter rated to 0.1 micron. Fits standard bottle threads.',
    art: 'filter',
    tone: '#c4dfd8',
  },
];

export const formatPrice = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
