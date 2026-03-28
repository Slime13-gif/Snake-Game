import { Skin } from './types';

export const SKINS: Skin[] = [
  { id: 'default', name: 'Sarı Ördek', color: '#FFD700', price: 0 },
  { id: 'tomato', name: 'Domates', color: '#FF6347', price: 100 },
  { id: 'turquoise', name: 'Turkuaz', color: '#00CED1', price: 250 },
  { id: 'purple', name: 'Mor Fırtına', color: '#9370DB', price: 500 },
  { id: 'lime', name: 'Yeşil Dev', color: '#32CD32', price: 1000 },
  { id: 'pink', name: 'Pembe Şeker', color: '#FF69B4', price: 2000 },
  { id: 'orange', name: 'Turuncu Güç', color: '#FFA500', price: 5000 },
  { id: 'secret_red_white', name: 'Gizli Kırmızı-Beyaz', color: '#FF0000', pattern: 'STRIPES', patternColor: '#FFFFFF', price: 0, isSecret: true },
];

export const COLORS = [
  '#FFD700', // Gold
  '#FF6347', // Tomato
  '#00CED1', // DarkTurquoise
  '#9370DB', // MediumPurple
  '#32CD32', // LimeGreen
  '#FF69B4', // HotPink
  '#FFA500', // Orange
];
