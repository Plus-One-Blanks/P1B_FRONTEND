import {
  data,
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
} from 'react-router';
import {useEffect, useState} from 'react';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {guardCustomerAccountAuth} from '~/lib/customerAccountAuth';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Addresses'}];
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

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    // this will ensure redirecting to login never happen for mutatation
    const isLoggedIn = await customerAccount.isLoggedIn();
    if (!isLoggedIn) {
      return data(
        {error: {[addressId]: 'Unauthorized'}},
        {
          status: 401,
        },
      );
    }

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : false;
    const address = {};
    const keys = [
      'address1',
      'address2',
      'city',
      'company',
      'territoryCode',
      'firstName',
      'lastName',
      'phoneNumber',
      'zoneCode',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {data, errors} = await customerAccount.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressCreate?.userErrors?.length) {
            throw new Error(data?.customerAddressCreate?.userErrors[0].message);
          }

          if (!data?.customerAddressCreate?.customerAddress) {
            throw new Error('Customer address create failed.');
          }

          return {
            error: null,
            createdAddress: data?.customerAddressCreate?.customerAddress,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {data, errors} = await customerAccount.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                addressId: decodeURIComponent(addressId),
                defaultAddress,
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressUpdate?.userErrors?.length) {
            throw new Error(data?.customerAddressUpdate?.userErrors[0].message);
          }

          if (!data?.customerAddressUpdate?.customerAddress) {
            throw new Error('Customer address update failed.');
          }

          return {
            error: null,
            updatedAddress: address,
            defaultAddress,
          };
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {data, errors} = await customerAccount.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {
                addressId: decodeURIComponent(addressId),
                language: customerAccount.i18n.language,
              },
            },
          );

          if (errors?.length) {
            throw new Error(errors[0].message);
          }

          if (data?.customerAddressDelete?.userErrors?.length) {
            throw new Error(data?.customerAddressDelete?.userErrors[0].message);
          }

          if (!data?.customerAddressDelete?.deletedAddressId) {
            throw new Error('Customer address delete failed.');
          }

          return {error: null, deletedAddress: addressId};
        } catch (error) {
          if (error instanceof Error) {
            return data(
              {error: {[addressId]: error.message}},
              {
                status: 400,
              },
            );
          }
          return data(
            {error: {[addressId]: error}},
            {
              status: 400,
            },
          );
        }
      }

      default: {
        return data(
          {error: {[addressId]: 'Method not allowed'}},
          {
            status: 405,
          },
        );
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      return data(
        {error: error.message},
        {
          status: 400,
        },
      );
    }
    return data(
      {error},
      {
        status: 400,
      },
    );
  }
}

export default function Addresses() {
  const {customer} = useOutletContext();
  const {defaultAddress, addresses} = customer;
  /** @type {import('@shopify/remix-oxygen').SerializeFrom<typeof action> | undefined} */
  const actionData = useActionData();
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(
    /** @type {string | null} */ (null),
  );
  const [deleteConfirmAddressId, setDeleteConfirmAddressId] = useState(
    /** @type {string | null} */ (null),
  );

  useEffect(() => {
    if (!actionData || actionData.error != null) return;
    if ('createdAddress' in actionData && actionData.createdAddress)
      setShowNewAddress(false);
    if ('updatedAddress' in actionData && actionData.updatedAddress != null)
      setEditingAddressId(null);
    if ('deletedAddress' in actionData && actionData.deletedAddress) {
      setEditingAddressId(null);
      setDeleteConfirmAddressId(null);
    }
  }, [actionData]);

  const hasAddresses = addresses.nodes.length > 0;
  const editingAddress =
    editingAddressId == null
      ? null
      : addresses.nodes.find((a) => a.id === editingAddressId) ?? null;

  return (
    <div className="account-section">
      <div className="account-section-header">
        <h2 className="account-section-title">Addresses</h2>
        <p className="account-section-subtitle">
          Manage your saved shipping addresses. Changes sync to your Shopify
          customer account.
        </p>
      </div>

      <div className="account-card account-addresses-panel">
        <div className="account-addresses-toolbar">
          <span className="account-addresses-toolbar-title">
            {hasAddresses ? 'Saved addresses' : 'Your addresses'}
          </span>
          <button
            type="button"
            className="account-btn-add-address"
            onClick={() => {
              setShowNewAddress((v) => !v);
              setEditingAddressId(null);
              setDeleteConfirmAddressId(null);
            }}
            aria-expanded={showNewAddress}
          >
            <span className="account-btn-add-address-icon" aria-hidden>
              +
            </span>
            Add an address
          </button>
        </div>

        {!hasAddresses ? (
          <div className="account-address-empty-wrap">
            {!showNewAddress ? (
              <div
                className="account-address-placeholder"
                role="region"
                aria-label="No saved addresses"
              >
                <p className="account-address-placeholder-title">
                  No saved addresses yet
                </p>
                <p className="account-address-placeholder-sub">
                  Add an address above — it saves to your account for checkout.
                </p>
              </div>
            ) : null}
            {showNewAddress ? (
              <div className="account-address-form-expanded">
                <NewAddressForm onCancel={() => setShowNewAddress(false)} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="account-address-list">
              {addresses.nodes.map((address) => (
                <AddressBookRow
                  key={address.id}
                  address={address}
                  isDefault={defaultAddress?.id === address.id}
                  onEdit={() => {
                    setShowNewAddress(false);
                    setDeleteConfirmAddressId(null);
                    setEditingAddressId(address.id);
                  }}
                  onRequestDelete={() => setDeleteConfirmAddressId(address.id)}
                />
              ))}
            </div>
            {showNewAddress ? (
              <div className="account-address-form-expanded account-address-new-below-list">
                <NewAddressForm
                  onCancel={() => setShowNewAddress(false)}
                />
              </div>
            ) : null}
          </>
        )}
      </div>

      {editingAddress ? (
        <AddressEditModal
          address={editingAddress}
          defaultAddress={defaultAddress}
          onClose={() => setEditingAddressId(null)}
        />
      ) : null}

      {deleteConfirmAddressId && hasAddresses ? (
        <DeleteAddressConfirmModal
          addressId={deleteConfirmAddressId}
          addresses={addresses.nodes}
          onClose={() => setDeleteConfirmAddressId(null)}
        />
      ) : null}
    </div>
  );
}

/**
 * @param {{ onCancel?: () => void }}
 */
function NewAddressForm({onCancel}) {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  };

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
      fieldIdPrefix="address-new"
    >
      {({stateForMethod}) => (
        <div className="account-form-actions account-form-actions-row">
          {onCancel ? (
            <button
              type="button"
              className="account-btn account-btn-secondary"
              onClick={onCancel}
              disabled={stateForMethod('POST') !== 'idle'}
            >
              Cancel
            </button>
          ) : null}
          <button
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
            className="account-btn account-btn-primary"
          >
            {stateForMethod('POST') !== 'idle' ? 'Saving…' : 'Save address'}
          </button>
        </div>
      )}
    </AddressForm>
  );
}

/**
 * @param {{
 *   address: import('customer-accountapi.generated').AddressFragment;
 *   isDefault: boolean;
 *   onEdit: () => void;
 *   onRequestDelete: () => void;
 * }}
 */
function AddressBookRow({address, isDefault, onEdit, onRequestDelete}) {
  const lines = formatAddressLines(address);
  const name = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  return (
    <div className="account-address-display-card">
      <div className="account-address-display-top">
        <p className="account-address-display-name">
          {name || 'Address'}
        </p>
        {isDefault ? (
          <span className="account-address-default-badge">Default</span>
        ) : null}
      </div>
      <div className="account-address-display-lines">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div className="account-address-card-actions account-address-card-actions--inline">
        <button
          type="button"
          className="account-btn account-btn-secondary account-address-action-btn"
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="account-btn account-btn-secondary account-address-action-btn"
          onClick={onRequestDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   addressId: import('customer-accountapi.generated').AddressFragment['id'];
 *   addresses: import('customer-accountapi.generated').AddressFragment[];
 *   onClose: () => void;
 * }}
 */
function DeleteAddressConfirmModal({addressId, addresses, onClose}) {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  const address = addresses.find((a) => a.id === addressId);

  useEffect(() => {
    if (!address) onClose();
  }, [address, onClose]);

  useEffect(() => {
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  if (!address) return null;

  const name = [address.firstName, address.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const lines = formatAddressLines(address).slice(0, 5);

  return (
    <div
      className="account-modal-overlay account-address-delete-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-address-delete-card-title"
    >
      <button
        type="button"
        className="account-modal-backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="account-modal account-modal--confirm account-address-delete-modal-dialog">
        <div className="account-modal-header">
          <h3
            className="account-modal-title"
            id="account-address-delete-card-title"
          >
            Delete this address?
          </h3>
          <button
            type="button"
            className="account-btn account-btn-secondary"
            disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            Close
          </button>
        </div>
        <div className="account-modal-body">
          <p className="account-address-delete-modal-summary-name">
            {name || 'Saved address'}
          </p>
          <div className="account-address-delete-modal-summary-lines">
            {lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <p className="account-address-delete-confirm-text">
            This can’t be undone. The address will be removed from your Shopify
            customer account.
          </p>
          <Form method="DELETE" className="account-address-delete-confirm-form">
            <input type="hidden" name="addressId" value={address.id} />
            <div className="account-modal-actions account-address-delete-modal-actions">
              <button
                type="button"
                className="account-btn account-btn-secondary"
                disabled={busy}
                onClick={() => {
                  if (!busy) onClose();
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="account-btn account-btn-danger"
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete address'}
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   address: import('customer-accountapi.generated').AddressFragment;
 *   defaultAddress: CustomerFragment['defaultAddress'];
 *   onClose: () => void;
 * }}
 */
function AddressEditModal({address, defaultAddress, onClose}) {
  const navigation = useNavigation();
  const busy = navigation.state !== 'idle';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    /** @param {KeyboardEvent} e */
    function onKey(e) {
      if (e.key === 'Escape' && !busy) {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy, showDeleteConfirm]);

  const safePrefix = String(address.id).replace(/[^a-zA-Z0-9-]/g, '-');

  return (
    <div
      className="account-modal-overlay account-address-edit-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-address-edit-heading"
    >
      <button
        type="button"
        className="account-modal-backdrop"
        aria-label="Close"
        disabled={busy}
        onClick={() => {
          if (!busy) {
            if (showDeleteConfirm) setShowDeleteConfirm(false);
            else onClose();
          }
        }}
      />
      <div className="account-modal account-address-edit-modal-dialog">
        <div className="account-modal-header">
          <div>
            <h3 className="account-modal-title" id="account-address-edit-heading">
              Edit address
            </h3>
            <p className="account-address-edit-modal-subtitle">
              Updates save to your Shopify customer account.
            </p>
          </div>
          <button
            type="button"
            className="account-btn account-btn-secondary"
            disabled={busy}
            onClick={() => {
              if (!busy) {
                if (showDeleteConfirm) setShowDeleteConfirm(false);
                else onClose();
              }
            }}
          >
            {showDeleteConfirm ? 'Back' : 'Close'}
          </button>
        </div>
        <div className="account-modal-body account-address-edit-modal-body account-address-edit-modal-body--relative">
          <AddressForm
            addressId={address.id}
            address={address}
            defaultAddress={defaultAddress}
            fieldIdPrefix={`addr-modal-${safePrefix}`}
          >
            {({stateForMethod}) => (
              <div className="account-form-actions account-address-edit-modal-actions">
                <button
                  type="button"
                  className="account-btn account-btn-secondary"
                  onClick={onClose}
                  disabled={
                    stateForMethod('PUT') !== 'idle' ||
                    stateForMethod('DELETE') !== 'idle' ||
                    showDeleteConfirm
                  }
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  formMethod="PUT"
                  className="account-btn account-btn-primary"
                  disabled={
                    stateForMethod('PUT') !== 'idle' || showDeleteConfirm
                  }
                >
                  {stateForMethod('PUT') !== 'idle' ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="account-btn account-btn-secondary"
                  disabled={
                    stateForMethod('PUT') !== 'idle' ||
                    stateForMethod('DELETE') !== 'idle'
                  }
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete
                </button>
              </div>
            )}
          </AddressForm>

          {showDeleteConfirm ? (
            <div
              className="account-address-delete-confirm-layer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-address-delete-confirm-title"
            >
              <h4
                className="account-address-delete-confirm-title"
                id="account-address-delete-confirm-title"
              >
                Delete this address?
              </h4>
              <p className="account-address-delete-confirm-text">
                This removes the address from your saved addresses. You can add
                it again later.
              </p>
              <Form method="DELETE" className="account-address-delete-confirm-form">
                <input type="hidden" name="addressId" value={address.id} />
                <div className="account-address-delete-confirm-actions">
                  <button
                    type="button"
                    className="account-btn account-btn-secondary"
                    disabled={busy}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="account-btn account-btn-danger"
                    disabled={busy}
                  >
                    {busy ? 'Deleting…' : 'Delete address'}
                  </button>
                </div>
              </Form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * @param {import('customer-accountapi.generated').AddressFragment} address
 */
function formatAddressLines(address) {
  const f = address.formatted;
  if (f != null) {
    if (Array.isArray(f)) return f.filter(Boolean);
    if (typeof f === 'string' && f.trim()) return [f];
  }
  const parts = [
    address.company,
    address.address1,
    address.address2,
    [address.city, address.zoneCode, address.zip].filter(Boolean).join(', '),
    address.territoryCode,
    address.phoneNumber,
  ].filter(Boolean);
  return parts.length ? parts.map(String) : ['—'];
}

/**
 * @param {{
 *   addressId: AddressFragment['id'];
 *   address: CustomerAddressInput;
 *   defaultAddress: CustomerFragment['defaultAddress'];
 *   fieldIdPrefix?: string;
 *   children: (props: {
 *     stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
 *   }) => React.ReactNode;
 * }}
 */
export function AddressForm({
  addressId,
  address,
  defaultAddress,
  fieldIdPrefix = 'address',
  children,
}) {
  const {state, formMethod} = useNavigation();
  /** @type {ActionReturnData} */
  const action = useActionData();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  const fid = (name) => `${fieldIdPrefix}-${name}`;
  return (
    <Form id={addressId} className="account-address-card">
      <fieldset className="account-fieldset">
        <input type="hidden" name="addressId" defaultValue={addressId} />
        <legend className="account-legend">
          {addressId === 'NEW_ADDRESS_ID' ? 'New address' : 'Edit address'}
        </legend>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('firstName')}>
            First name*
          </label>
        <input
          className="account-input"
          aria-label="First name"
          autoComplete="given-name"
          defaultValue={address?.firstName ?? ''}
          id={fid('firstName')}
          name="firstName"
          placeholder="First name"
          required
          type="text"
        />
        </div>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('lastName')}>
            Last name*
          </label>
        <input
          className="account-input"
          aria-label="Last name"
          autoComplete="family-name"
          defaultValue={address?.lastName ?? ''}
          id={fid('lastName')}
          name="lastName"
          placeholder="Last name"
          required
          type="text"
        />
        </div>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('company')}>
            Company
          </label>
        <input
          className="account-input"
          aria-label="Company"
          autoComplete="organization"
          defaultValue={address?.company ?? ''}
          id={fid('company')}
          name="company"
          placeholder="Company"
          type="text"
        />
        </div>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('address1')}>
            Address line*
          </label>
        <input
          className="account-input"
          aria-label="Address line 1"
          autoComplete="address-line1"
          defaultValue={address?.address1 ?? ''}
          id={fid('address1')}
          name="address1"
          placeholder="Address line 1*"
          required
          type="text"
        />
        </div>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('address2')}>
            Address line 2
          </label>
        <input
          className="account-input"
          aria-label="Address line 2"
          autoComplete="address-line2"
          defaultValue={address?.address2 ?? ''}
          id={fid('address2')}
          name="address2"
          placeholder="Address line 2"
          type="text"
        />
        </div>

        <div className="account-grid-2">
          <div className="account-field">
            <label className="account-label" htmlFor={fid('city')}>
              City*
            </label>
        <input
          className="account-input"
          aria-label="City"
          autoComplete="address-level2"
          defaultValue={address?.city ?? ''}
          id={fid('city')}
          name="city"
          placeholder="City"
          required
          type="text"
        />
          </div>
          <div className="account-field">
            <label className="account-label" htmlFor={fid('zoneCode')}>
              State / Province*
            </label>
        <input
          className="account-input"
          aria-label="State/Province"
          autoComplete="address-level1"
          defaultValue={address?.zoneCode ?? ''}
          id={fid('zoneCode')}
          name="zoneCode"
          placeholder="State / Province"
          required
          type="text"
        />
          </div>
        </div>

        <div className="account-grid-2">
          <div className="account-field">
            <label className="account-label" htmlFor={fid('zip')}>
              Zip / Postal Code*
            </label>
        <input
          className="account-input"
          aria-label="Zip"
          autoComplete="postal-code"
          defaultValue={address?.zip ?? ''}
          id={fid('zip')}
          name="zip"
          placeholder="Zip / Postal Code"
          required
          type="text"
        />
          </div>
          <div className="account-field">
            <label className="account-label" htmlFor={fid('territoryCode')}>
              Country Code*
            </label>
        <input
          className="account-input"
          aria-label="territoryCode"
          autoComplete="country"
          defaultValue={address?.territoryCode ?? ''}
          id={fid('territoryCode')}
          name="territoryCode"
          placeholder="Country"
          required
          type="text"
          maxLength={2}
        />
          </div>
        </div>

        <div className="account-field">
          <label className="account-label" htmlFor={fid('phoneNumber')}>
            Phone
          </label>
        <input
          className="account-input"
          aria-label="Phone Number"
          autoComplete="tel"
          defaultValue={address?.phoneNumber ?? ''}
          id={fid('phoneNumber')}
          name="phoneNumber"
          placeholder="+16135551111"
          pattern="^\+?[1-9]\d{3,14}$"
          type="tel"
        />
        </div>

        <div className="account-check-row">
          <input
            defaultChecked={isDefaultAddress}
            id={fid('defaultAddress')}
            name="defaultAddress"
            type="checkbox"
          />
          <label htmlFor={fid('defaultAddress')}>Set as default address</label>
        </div>
        {error ? (
          <p className="account-alert account-alert-error" role="alert">
            {error}
          </p>
        ) : null}
        {children({
          stateForMethod: (method) => (formMethod === method ? state : 'idle'),
        })}
      </fieldset>
    </Form>
  );
}

/**
 * @typedef {{
 *   addressId?: string | null;
 *   createdAddress?: AddressFragment;
 *   defaultAddress?: string | null;
 *   deletedAddress?: string | null;
 *   error: Record<AddressFragment['id'], string> | null;
 *   updatedAddress?: AddressFragment;
 * }} ActionResponse
 */

/** @typedef {import('@shopify/hydrogen/customer-account-api-types').CustomerAddressInput} CustomerAddressInput */
/** @typedef {import('customer-accountapi.generated').AddressFragment} AddressFragment */
/** @typedef {import('customer-accountapi.generated').CustomerFragment} CustomerFragment */
/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('./+types/account.addresses').Route} Route */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof loader>} LoaderReturnData */
/** @typedef {import('@shopify/remix-oxygen').SerializeFrom<typeof action>} ActionReturnData */
