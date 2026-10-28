import { BrowserRouter, Route, Routes } from 'react-router';
import Layout from './components/Layout';
import type { ShopperId, ShopperProfile } from './launchdarkly/contexts';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import ProductPage from './pages/ProductPage';
import Shop from './pages/Shop';
import { CartProvider } from './state/Cart';
import { ReleaseLogProvider } from './state/ReleaseLog';
import { ToastProvider } from './state/Toasts';

interface AppProps {
  shoppers: Record<ShopperId, ShopperProfile>;
}

export default function App({ shoppers }: AppProps) {
  return (
    <ToastProvider>
      <ReleaseLogProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout shoppers={shoppers} />}>
                <Route index element={<Home />} />
                <Route path="shop" element={<Shop />} />
                <Route path="products/:productId" element={<ProductPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </ReleaseLogProvider>
    </ToastProvider>
  );
}
