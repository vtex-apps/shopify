import { Heading, Page, Form, Button, FormLayout, TextField } from "@shopify/polaris";
import React from 'react';

class Index extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      account_name: '',
      app_key: '',
      app_token: '',
      seller_id: '',
      access_token: '',
      account_name_error: null,
      app_key_error: null,
      app_token_error: null,
      seller_id_error: null,
      access_token_error: null
    };
  }

  componentDidMount() {
    this.getSettings()
  }

  async getSettings() {
    await fetch('/admin/apps/vtex_connector_settings')
      .then(response => response.json())
      .then(json => {
        if (Object.keys(json).length) {
          const { account_name, app_key, app_token, seller_id, access_token } = json
          this.setState({ account_name, app_key, app_token, seller_id, access_token })
        }
      })
  }

  handleSubmit() {
    const { account_name, app_key, app_token, seller_id, access_token } = this.state
    if (this.validateForm()) {
      fetch('/admin/apps/vtex_connector', {
        method: 'POST',
        body: JSON.stringify({ account_name, app_key, app_token, seller_id, access_token })
      })
        .then(response => response.json())
        .then(() => window.location.reload())
    }
  }

  validateForm() {
    const {
      account_name,
      app_key,
      app_token,
      seller_id,
      access_token
    } = this.state

    const account_name_error = account_name !== "" ? null : "Required"
    const app_key_error = app_key !== "" ? null : "Required"
    const app_token_error = app_token !== "" ? null : "Required"
    const seller_id_error = seller_id !== "" ? null : "Required"
    const access_token_error = access_token !== "" ? null : "Required"

    this.setState({
      account_name_error,
      app_key_error,
      app_token_error,
      seller_id_error,
      access_token_error
    })

    return !account_name_error
      && !app_key_error
      && !app_token_error
      && !seller_id_error
      && !access_token_error;
  }


  render() {
    return (
      <Page>
        <Heading>VTEX connector settings</Heading>
        <br/>
        <Form onSubmit={() => this.handleSubmit()}>
          <FormLayout>
            <TextField
              value={this.state.account_name}
              onChange={value => this.setState({ account_name: value })}
              label="Marketplace account"
              type="text"
              error={this.state.account_name_error}
            />

            <TextField
              value={this.state.app_key}
              onChange={value => this.setState({ app_key: value })}
              label="App key"
              type="text"
              error={this.state.app_key_error}
            />

            <TextField
              value={this.state.app_token}
              onChange={value => this.setState({ app_token: value })}
              label="App token"
              type="text"
              error={this.state.app_token_error}
            />

            <TextField
              value={this.state.seller_id}
              onChange={value => this.setState({ seller_id: value })}
              label="Seller ID"
              type="text"
              error={this.state.seller_id_error}
            />

            <TextField
              value={this.state.access_token}
              onChange={value => this.setState({ access_token: value })}
              label="Fulfillment API Access Token"
              type="text"
              error={this.state.access_token_error}
            />

            <Button submit>Submit</Button>
          </FormLayout>
        </Form>
      </Page>
    )
  }

}

export default Index;
