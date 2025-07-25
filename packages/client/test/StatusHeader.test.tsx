import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import StatusHeader from '../src/components/StatusHeader';

describe('StatusHeader', () => {
  const defaultProps = {
    ironAmount: 1000,
    statusIndicator: 'grey' as const,
    onStatusClick: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('statusHeader_defaultProps_rendersCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} />);

    // Assert - Text is split across spans
    expect(screen.getByText('Iron:')).toBeInTheDocument();
    expect(screen.getByText('1.000')).toBeInTheDocument(); // German locale uses dots
    expect(screen.getByTitle('Status indicator')).toBeInTheDocument();
  });

  test('statusHeader_formatsLargeNumbers_withLocaleFormat', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={1234567} />);

    // Assert - Use toLocaleString format (dots in German locale)
    expect(screen.getByText('1.234.567')).toBeInTheDocument();
  });

  test('statusHeader_zeroIron_displaysZero', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={0} />);

    // Assert
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  test('statusHeader_clickStatusIndicator_callsOnStatusClick', () => {
    // Arrange
    const mockOnStatusClick = jest.fn();

    // Act
    render(<StatusHeader {...defaultProps} onStatusClick={mockOnStatusClick} isClickable={true} />);
    fireEvent.click(screen.getByTitle('Status indicator'));

    // Assert
    expect(mockOnStatusClick).toHaveBeenCalledTimes(1);
  });

  test('statusHeader_notClickable_doesNotCallOnStatusClick', () => {
    // Arrange
    const mockOnStatusClick = jest.fn();

    // Act
    render(<StatusHeader {...defaultProps} onStatusClick={mockOnStatusClick} isClickable={false} />);
    fireEvent.click(screen.getByTitle('Status indicator'));

    // Assert
    expect(mockOnStatusClick).not.toHaveBeenCalled();
  });

  test('statusHeader_loadingState_showsLoadingIndicator', () => {
    // Act
    render(<StatusHeader {...defaultProps} isLoading={true} />);

    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  test('statusHeader_greyIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="grey" />);

    // Assert
    const indicator = screen.getByTitle('Status indicator');
    expect(indicator).toHaveClass('status-indicator', 'grey');
  });

  test('statusHeader_redIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="red" />);

    // Assert
    const indicator = screen.getByTitle('Status indicator');
    expect(indicator).toHaveClass('status-indicator', 'red');
  });

  test('statusHeader_greenIndicator_hasCorrectClass', () => {
    // Act
    render(<StatusHeader {...defaultProps} statusIndicator="green" />);

    // Assert
    const indicator = screen.getByTitle('Status indicator');
    expect(indicator).toHaveClass('status-indicator', 'green');
  });

  test('statusHeader_fractionalIron_formatsCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={1234.67} />);

    // Assert - Check for the actual formatted output
    expect(screen.getByText('1.234,67')).toBeInTheDocument();
  });

  test('statusHeader_negativeIron_handlesCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={-100} />);

    // Assert
    expect(screen.getByText('-100')).toBeInTheDocument();
  });

  test('statusHeader_veryLargeNumber_formatsCorrectly', () => {
    // Act
    render(<StatusHeader {...defaultProps} ironAmount={9876543210} />);

    // Assert - Use dots for German locale
    expect(screen.getByText('9.876.543.210')).toBeInTheDocument();
  });

  test('statusHeader_withoutLoading_doesNotShowLoadingText', () => {
    // Act
    render(<StatusHeader {...defaultProps} isLoading={false} />);

    // Assert
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  test('statusHeader_loadingWithIronAmount_showsLoadingNotIron', () => {
    // Act
    render(<StatusHeader {...defaultProps} isLoading={true} ironAmount={500} />);

    // Assert
    expect(screen.getByText('...')).toBeInTheDocument();
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });
});
