import React from 'react';
import { ResetPasswordClient } from './ResetPasswordClient';

interface ResetPasswordPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const ResetPasswordPage: React.FC<ResetPasswordPageProps> = async ({ searchParams }) => {
  const params: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const token = typeof params.token === 'string' ? params.token : null;

  return <ResetPasswordClient token={token} />;
};

export default ResetPasswordPage;
