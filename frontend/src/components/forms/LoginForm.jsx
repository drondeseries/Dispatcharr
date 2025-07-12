import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/auth';
import { Paper, Title, TextInput, Button, Center, Stack } from '@mantine/core';

const LoginForm = () => {
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initData = useAuthStore((s) => s.initData);

  const navigate = useNavigate(); // Hook to navigate to other routes
  const [formData, setFormData] = useState({ username: '', password: '' });

  // useEffect(() => {
  //   if (isAuthenticated) {
  //     navigate('/channels');
  //   }
  // }, [isAuthenticated, navigate]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await login(formData);

    try {
      await initData();
      navigate('/channels');
    } catch (e) {
      console.log(`Failed to login: ${e}`);
    }
  };

  return (
    <Center
      style={{
        height: '100vh',
      }}
    >
      <Paper
        elevation={3}
        style={{ padding: 30, width: '100%', maxWidth: 400 }}
      >
        <Title order={4} align="center">
          Login
        </Title>
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
            />

            <TextInput
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              // required
            />

            <Button type="submit" mt="sm">
              Login
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
};

export default LoginForm;
