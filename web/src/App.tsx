import { BrowserRouter, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import type { Persona, PersonaId } from './launchdarkly/contexts';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import ProductPage from './pages/ProductPage';
import Shop from './pages/Shop';
import { CartProvider } from './state/Cart';
import { ReleaseLogProvider } from './state/ReleaseLog';
import { ShopperProvider } from './state/Shopper';
import { ToastProvider } from './state/Toasts';

interface AppProps {
  personas: Record<PersonaId, Persona>;
}

export default function App({ personas }: AppProps) {
  return (
    <ToastProvider>
      <ReleaseLogProvider>
        <ShopperProvider personas={personas}>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="products/:productId" element={<ProductPage />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </ShopperProvider>
      </ReleaseLogProvider>
    </ToastProvider>
  );
}
