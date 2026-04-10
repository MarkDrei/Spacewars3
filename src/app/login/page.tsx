import React from 'react';
import { LoginPageComponent } from '@/components/LoginPageComponent';

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

// Server component — reads searchParams and passes them to the client component
const LoginPage: React.FC<LoginPageProps> = async ({ searchParams }) => {
  const params: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const verified = typeof params.verified === 'string' ? params.verified : null;
  const error = typeof params.error === 'string' ? params.error : null;

  return <LoginPageComponent verifiedParam={verified} errorParam={error} />;
};

export default LoginPage;
