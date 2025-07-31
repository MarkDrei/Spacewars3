import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../src/pages/Login/LoginPage';

// Mock functions for props
const mockOnLogin = vi.fn();
const mockOnRegister = vi.fn();

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to get submit button
  const getSubmitButton = () => {
    return screen.getAllByRole('button').find(button => 
      button.getAttribute('type') === 'submit'
    );
  };

  it('should render the login form by default', () => {
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    expect(screen.getByText('Spacewars: Ironcore')).toBeInTheDocument();
    expect(screen.getByText('Welcome to the space exploration game.')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    // Check for submit button
    expect(getSubmitButton()).toBeInTheDocument();
    // Look for both sign up elements
    expect(screen.getAllByText('Sign Up')).toHaveLength(2); // Tab and footer link
  });

  it('should switch to sign up mode when Sign Up tab is clicked', async () => {
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    // Click the Sign Up tab (not the footer link)
    const signUpTab = screen.getAllByText('Sign Up')[0]; // First one should be the tab
    await user.click(signUpTab);
    
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('should show validation error when submitting empty form', async () => {
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    // Click the submit button
    const submitButton = getSubmitButton();
    await user.click(submitButton!);
    
    // Check the username input for native validation message
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement;
    // The browser sets validationMessage if the field is required and empty
    expect(usernameInput).toBeRequired();
    expect(usernameInput.validationMessage).toMatch("Constraints not satisfied");
    // The login function should not be called
    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it('should show validation error when passwords do not match in sign up mode', async () => {
    const user = userEvent.setup();
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    // Switch to sign up mode
    const signUpTab = screen.getAllByText('Sign Up')[0];
    await user.click(signUpTab);
    
    // Fill form with mismatched passwords using batch operations
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'differentpassword' } });
    
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    expect(mockOnRegister).not.toHaveBeenCalled();
  });

  // it('should call onLogin with correct credentials when login form is submitted', async () => {
  //   const user = userEvent.setup();
  //   mockOnLogin.mockResolvedValue({ success: true });
    
  //   render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
  //   fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    
  //   const submitButton = getSubmitButton();
  //   await user.click(submitButton!);
    
  //   expect(mockOnLogin).toHaveBeenCalledWith('testuser', 'password123');
  // });

  it('should call onRegister with correct credentials when register form is submitted', async () => {
    const user = userEvent.setup();
    mockOnRegister.mockResolvedValue({ success: true });
    
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    // Switch to sign up mode
    const signUpTab = screen.getAllByText('Sign Up')[0];
    await user.click(signUpTab);
    
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } });
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    expect(mockOnRegister).toHaveBeenCalledWith('newuser', 'password123');
  });

  // it('should display error message when login fails', async () => {
  //   const user = userEvent.setup();
  //   mockOnLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });
    
  //   render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
  //   fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } });
    
  //   const submitButton = getSubmitButton();
  //   await user.click(submitButton!);
    
  //   await waitFor(() => {
  //     expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  //   });
  // });

  it('should display error message when registration fails', async () => {
    const user = userEvent.setup();
    mockOnRegister.mockResolvedValue({ success: false, error: 'Username taken' });
    
    render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
    // Switch to sign up mode
    const signUpTab = screen.getAllByText('Sign Up')[0];
    await user.click(signUpTab);
    
    // Use batch operations for faster input
    const usernameInput = screen.getByLabelText('Username');
    const passwordInput = screen.getByLabelText('Password');
    const confirmPasswordInput = screen.getByLabelText('Confirm Password');
    
    fireEvent.change(usernameInput, { target: { value: 'existinguser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.change(confirmPasswordInput, { target: { value: 'password123' } });
    
    await user.click(screen.getByRole('button', { name: 'Create Account' }));
    
    await waitFor(() => {
      expect(screen.getByText('Username taken')).toBeInTheDocument();
    }, { interval: 5 });
  });

  // it('should clear error message when user starts typing', async () => {
  //   const user = userEvent.setup();
  //   render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
  //   // First, let's create an error by triggering a failed login
  //   mockOnLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });
    
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'user' } });
  //   fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    
  //   const submitButton = getSubmitButton();
  //   await user.click(submitButton!);
    
  //   // Wait for error message to appear
  //   await waitFor(() => {
  //     expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  //   });
    
  //   // Clear the input and type new text - error should clear
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: '' } });
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'newuser' } });
    
  //   expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
  // });

  // it('should disable form inputs and button when loading', async () => {
  //   const user = userEvent.setup();
  //   // Create a promise that we can control
  //   let resolveLogin: (value: { success: boolean; error?: string }) => void;
  //   const loginPromise = new Promise<{ success: boolean; error?: string }>(resolve => {
  //     resolveLogin = resolve;
  //   });
  //   mockOnLogin.mockReturnValue(loginPromise);
    
  //   render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
  //   fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    
  //   const submitButton = getSubmitButton();
  //   await user.click(submitButton!);
    
  //   // Check that inputs and button are disabled
  //   expect(screen.getByLabelText('Username')).toBeDisabled();
  //   expect(screen.getByLabelText('Password')).toBeDisabled();
  //   expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();
    
  //   // Resolve the promise and wait for state updates
  //   resolveLogin!({ success: true });
    
  //   // Wait for the loading state to be cleared
  //   await waitFor(() => {
  //     expect(screen.queryByRole('button', { name: 'Loading...' })).not.toBeInTheDocument();
  //   });
  // });

  // it('should reset form when switching between login and register modes', async () => {
  //   const user = userEvent.setup();
  //   render(<LoginPage onLogin={mockOnLogin} onRegister={mockOnRegister} />);
    
  //   // Fill login form
  //   fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'testuser' } });
  //   fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    
  //   // Switch to sign up mode
  //   const signUpTab = screen.getAllByText('Sign Up')[0];
  //   await user.click(signUpTab);
    
  //   // Form should be cleared
  //   expect(screen.getByLabelText('Username')).toHaveValue('');
  //   expect(screen.getByLabelText('Password')).toHaveValue('');
  //   expect(screen.getByLabelText('Confirm Password')).toHaveValue('');
  // });
});
