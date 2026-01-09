import { ClickUI } from '@make-software/csprclick-ui';
import './globals.css';
import CasperProvider from '@/context/CasperProvider';
import Navbar from '@/components/Navbar';

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <html lang="en">
      <body>
        <div id="root" />
        <CasperProvider>
          <main className="min-h-screen pt-20 ">
            <Navbar />
            {children}
          </main>
        </CasperProvider>
      </body>
    </html>
  );
};

export default RootLayout;
