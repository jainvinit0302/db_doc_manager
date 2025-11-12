import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "#f87171", padding: "8px" }}>
          ⚠️ Render error: {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}
