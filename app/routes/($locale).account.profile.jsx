import {CUSTOMER_UPDATE_MUTATION} from '~/graphql/customer-account/CustomerUpdateMutation';
import {guardCustomerAccountAuth} from '~/lib/customerAccountAuth';
import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  useSubmit,
} from 'react-router';
import {useEffect, useId, useState} from 'react';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Profile'}];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const authRedirect = await guardCustomerAccountAuth(context.customerAccount);
  if (authRedirect) {
    return authRedirect;
  }

  return {};
}

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customerUpdate = {};
    const validInputKeys = ['firstName', 'lastName'];
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customerUpdate[key] = value;
      }
    }

    const {data: result, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer: customerUpdate,
          language: customerAccount.i18n.language,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    const payload = result?.customerUpdate;
    const userErrors = payload?.userErrors ?? [];
    if (userErrors.length > 0) {
      throw new Error(userErrors.map((e) => e.message).join(' '));
    }

    if (!payload?.customer) {
      throw new Error('Customer profile update failed.');
    }

    return {
      error: null,
      customer: payload.customer,
    };
  } catch (error) {
    return data(
      {error: error.message, customer: null},
      {
        status: 400,
      },
    );
  }
}

/**
 * @typedef {{
 *   customer?: import('customer-accountapi.generated').CustomerDetailsQuery['customer'];
 * }} AccountOutletContext
 */

export default function AccountProfile() {
  const account = useOutletContext();
  const submit = useSubmit();
  const {state} = useNavigation();
  /** @type {ActionReturnData | undefined} */
  const action = useActionData();

  /** @type {AccountOutletContext['customer']} */
  const customer = action?.customer ?? account?.customer;

  const formId = useId();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const emailDisplay = customer?.emailAddress?.emailAddress ?? '';
  const phoneDisplay = customer?.phoneNumber?.phoneNumber ?? '';

  useEffect(() => {
    if (action?.customer && !action?.error) {
      setConfirmOpen(false);
    }
  }, [action]);

  useEffect(() => {
    if (!confirmOpen) {
      return undefined;
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setConfirmOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen]);

  const openConfirm = () => {
    setConfirmOpen(true);
  };

  const submitConfirmed = () => {
    const el = document.getElementById(formId);
    if (!(el instanceof HTMLFormElement)) {
      return;
    }
    if (!el.reportValidity()) {
      return;
    }
    const formData = new FormData(el);
    submit(formData, {method: 'PUT'});
    setConfirmOpen(false);
  };

  const busy = state !== 'idle';

  return (
    <div className="account-section">
      <div className="account-section-header">
        <h2 className="account-section-title">Profile</h2>
        <p className="account-section-subtitle">
          View your contact details and update your name on your Shopify customer
          account.
        </p>
      </div>

      <div className="account-card">
        <Form
          id={formId}
          method="PUT"
          className="account-form"
          onSubmit={(event) => event.preventDefault()}
        >
          <fieldset className="account-fieldset">
            <legend className="account-legend">Contact information</legend>

            <div className="account-field">
              <label className="account-label" htmlFor={`${formId}-email`}>
                Email
              </label>
              <input
                id={`${formId}-email`}
                className="account-input account-input-readonly"
                type="email"
                readOnly
                autoComplete="email"
                aria-readonly="true"
                defaultValue={emailDisplay}
              />
              <p className="account-field-hint">
                Shopify doesn&apos;t allow changing email here. Update it through
                your store sign-in settings if needed.
              </p>
            </div>

            <div className="account-field">
              <label className="account-label" htmlFor={`${formId}-phone`}>
                Phone
              </label>
              <input
                id={`${formId}-phone`}
                className="account-input account-input-readonly"
                type="tel"
                readOnly
                autoComplete="tel"
                aria-readonly="true"
                defaultValue={phoneDisplay}
              />
              <p className="account-field-hint">
                Phone updates aren&apos;t available on this profile form through
                the Customer Account API. Contact Plus One Blanks if you need it
                changed.
              </p>
            </div>
          </fieldset>

          <fieldset className="account-fieldset">
            <legend className="account-legend">Personal information</legend>

            <div className="account-field">
              <label className="account-label" htmlFor={`${formId}-firstName`}>
                First name
              </label>
              <input
                className="account-input"
                id={`${formId}-firstName`}
                name="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="First name"
                aria-label="First name"
                defaultValue={customer?.firstName ?? ''}
                minLength={2}
              />
            </div>

            <div className="account-field">
              <label className="account-label" htmlFor={`${formId}-lastName`}>
                Last name
              </label>
              <input
                className="account-input"
                id={`${formId}-lastName`}
                name="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Last name"
                aria-label="Last name"
                defaultValue={customer?.lastName ?? ''}
                minLength={2}
              />
            </div>
          </fieldset>

          {action?.error ? (
            <p className="account-alert account-alert-error" role="alert">
              {action.error}
            </p>
          ) : null}

          <div className="account-form-actions">
            <button
              className="account-btn account-btn-primary"
              type="button"
              disabled={busy}
              onClick={openConfirm}
            >
              {busy ? 'Updating…' : 'Update profile'}
            </button>
          </div>
        </Form>
      </div>

      {confirmOpen ? (
        <div
          className="account-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-update-confirm-title"
          aria-describedby="profile-update-confirm-desc"
        >
          <button
            type="button"
            className="account-modal-backdrop"
            aria-label="Close"
            onClick={() => setConfirmOpen(false)}
          />
          <div className="account-modal account-modal--confirm">
            <div className="account-modal-header">
              <div>
                <h3 id="profile-update-confirm-title" className="account-modal-title">
                  Save to Shopify?
                </h3>
                <p id="profile-update-confirm-desc" className="account-modal-subtitle">
                  This will update your first name and last name on your Shopify
                  customer profile. Email and phone are not changed here.
                </p>
              </div>
            </div>
            <div className="account-modal-body">
              <div className="account-modal-actions">
                <button
                  type="button"
                  className="account-btn account-btn-secondary"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="account-btn account-btn-primary"
                  disabled={busy}
                  onClick={submitConfirmed}
                >
                  {busy ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @typedef {import('./+types/account.profile').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof action>} ActionReturnData */
