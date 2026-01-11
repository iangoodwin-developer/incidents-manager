// app shell w router + shared styles
// router is hash based so no extra deps

import React from 'react';
import './App.scss';
import { AppRouter } from './AppRouter';

export function App() {
  return (
    <div className="app">
      <AppRouter />
    </div>
  );
}
