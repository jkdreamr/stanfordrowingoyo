import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLogout } from '../lib/queries';
import { authError } from '../lib/auth';
import { Placeholder } from '../components/shell/Placeholder';
import { Button } from '../components/ui';
import { FormErrors } from '../components/auth/FormErrors';
export default function Settings() {
  const logout = useLogout();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string>();
  return (
    <Placeholder title="Settings" back="/me">
      <FormErrors message={message} />
      <Button
        variant="destructive"
        fullWidth
        loading={logout.isPending}
        onClick={() => {
          setMessage(undefined);
          logout.mutate(
            {},
            {
              onSuccess: () => navigate('/login', { replace: true }),
              onError: (error) => setMessage(authError(error)),
            },
          );
        }}
      >
        Log Out
      </Button>
    </Placeholder>
  );
}
