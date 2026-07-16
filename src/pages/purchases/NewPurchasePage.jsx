import React, { useState, useEffect, useContext } from 'react';
import { PlusCircle, Trash2, Printer, Save, Star, ShieldAlert, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { SeasonContext } from '../../context/SeasonContext';
import SearchableSelect from '../../components/SearchableSelect';
import FormField from '../../components/FormField';

export default function NewPurchasePage() {
  const navigate = useNavigate();
  const { activeSeason } = useContext(SeasonContext);
  
  const [loading, setLoading] = useState(true);
  const [parties, setParties] = useState([]);
  const [partiesRaw, setPartiesRaw] = useState([]);
  const [associates, setAssociates] = useState([]);
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [partyOutstanding, setPartyOutstanding] = useState(null);
  const [partyRating, setPartyRating] = useState(null);
  const [showDelayWarning, setShowDelayWarning] = useState(false);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    purchase_type: 'kaccha',
    party_id: '',
    discount: 0,
    cgst_percent: 0,
    sgst_percent: 0,
    amount_paid: 0,
    remarks: '',
    coupon_no: ''
  });

  const [invoiceNo, setInvoiceNo] = useState('');
  
  const [items, setItems] = useState([
    { id: Date.now(), product_id: '', batch_id: '', batch_no: '', batches: [], mfg_date: '', qty: '', unit: '', rate: '', amount: 0 }
  ]);



  useEffect(() => {
    if (activeSeason) {
      loadInitialData();
    }
  }, [activeSeason]);

  // Adjust GST defaults based on purchase type
  useEffect(() => {
    if (formData.purchase_type === 'pakka') {
      setFormData(prev => ({ ...prev, cgst_percent: 9, sgst_percent: 9 }));
    } else {
      setFormData(prev => ({ ...prev, cgst_percent: 0, sgst_percent: 0 }));
    }
  }, [formData.purchase_type]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [partiesData, productsData, nextInvoice, couponsData] = await Promise.all([
        window.db.invoke('parties:getAll'),
        window.db.invoke('products:getAll'),
        window.db.invoke('purchases:getNextInvoice', activeSeason.id),
        window.db.invoke('coupons:getAll', activeSeason.id)
      ]);
      
      setPartiesRaw(partiesData);
      setParties(partiesData.map(p => ({ value: p.id, label: p.name, sublabel: p.village })));
      setProducts(productsData);
      setInvoiceNo(nextInvoice);
      setCoupons(couponsData || []);
    } catch (err) {
      toast.error('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = async (index, field, value) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === 'product_id') {
      item.product_id = value;
      const product = products.find(p => p.id === value);
      if (product) {
        item.unit = product.unit || '';
        item.rate = product.dealer_price || 0;
      }
      try {
        const batches = await window.db.invoke('batches:getByProduct', value);
        item.batches = batches || [];
        
        const date = formData.date ? new Date(formData.date) : new Date();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        let prefix = 'ABX';
        let year2 = String(date.getFullYear()).slice(2);
        if (activeSeason) {
          prefix = activeSeason.name?.toLowerCase().includes('kharif') ? 'ABK' : 'ABR';
          const seasonYearMatch = activeSeason.name?.match(/\d{4}/);
          if (seasonYearMatch) {
            year2 = seasonYearMatch[0].slice(2);
          }
        }
        item.batch_no = `${prefix}${year2}${m}`;
        item.batch_id = '';
        
        item.mfg_date = batches.length > 0 ? batches[0].mfg_date : `${date.getFullYear()}-${m}`;
      } catch (err) {
        toast.error('Failed to load batches');
        item.batches = [];
      }
    } else if (field === 'batch_id') {
      item.batch_id = value;
      const batch = item.batches.find(b => b.id === Number(value));
      if (batch) item.mfg_date = batch.mfg_date;
    } else if (field === 'unit') {
      item.unit = value;
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        if (value === product.alt_unit && product.dealer_price_alt) {
          item.rate = product.dealer_price_alt;
        } else {
          item.rate = product.dealer_price || 0;
        }
      }
    } else {
      item[field] = value;
    }

    // Auto-calculate amount
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    item.amount = qty * rate;

    setItems(newItems);
  };

  const addItemRow = () => {
    setItems([...items, { id: Date.now(), product_id: '', batch_id: '', batches: [], mfg_date: '', qty: '', unit: '', rate: '', amount: 0 }]);
  };

  const removeItemRow = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const discount = Number(formData.discount) || 0;
  const taxableAmount = subtotal - discount;
  
  const cgstAmount = formData.purchase_type === 'pakka' ? (taxableAmount * (Number(formData.cgst_percent) || 0)) / 100 : 0;
  const sgstAmount = formData.purchase_type === 'pakka' ? (taxableAmount * (Number(formData.sgst_percent) || 0)) / 100 : 0;
  
  const grandTotal = taxableAmount + cgstAmount + sgstAmount;
  const amountPaid = Number(formData.amount_paid) || 0;
  const balanceDue = grandTotal - amountPaid;

  const validate = () => {
    if (!formData.party_id) {
      toast.error('Please select a party');
      return false;
    }
    const validItems = items.filter(i => i.product_id && i.qty > 0 && i.rate > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one valid item with quantity and rate');
      return false;
    }
    return true;
  };

  const handleSave = async (print = false) => {
    if (!validate()) return;
    
    try {
      const validItems = items.filter(i => i.product_id && i.qty > 0 && i.rate > 0).map(i => ({
        product_id: i.product_id,
        batch_id: i.batch_id || null,
        batch_no: i.batch_no || '',
        qty: Number(i.qty),
        unit: i.unit,
        rate: Number(i.rate),
        amount: Number(i.amount),
        mfg_date: i.mfg_date || ''
      }));

      const purchaseData = {
        ...formData,
        season_id: activeSeason.id,
        invoice_no: invoiceNo,
        total_amount: grandTotal,
        discount: discount,
        cgst_percent: formData.purchase_type === 'pakka' ? Number(formData.cgst_percent) : 0,
        sgst_percent: formData.purchase_type === 'pakka' ? Number(formData.sgst_percent) : 0,
        amount_paid: amountPaid,
        items: validItems
      };

      const result = await window.db.invoke('purchases:add', purchaseData);
      toast.success('Purchase saved successfully');
      
      if (print) {
        // We'll implement printing in AllPurchasesPage or a dedicated print util
        toast.success('Print triggered for ' + result.invoice_no);
      }
      
      navigate('/purchases/all');
    } catch (err) {
      toast.error('Failed to save purchase: ' + err.message);
    }
  };

  if (!activeSeason) {
    return <div className="p-6">Please set an active season first.</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-800">New Purchase Entry</h1>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-6">
        {/* Header Details */}
        <div className="col-span-12 lg:col-span-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Party" required>
            <SearchableSelect
              options={parties}
              value={formData.party_id}
              onChange={v => {
                setFormData({ ...formData, party_id: v, coupon_no: '' });
                const selectedParty = partiesRaw.find(p => p.id === v);
                setPartyOutstanding(selectedParty ? (selectedParty.balance || 0) : null);
                setPartyRating(selectedParty ? (selectedParty.rating || 'B') : null);
                if (selectedParty && selectedParty.rating === 'D') {
                  setShowDelayWarning(true);
                }
              }}
              placeholder="Select Party..."
            />
            {/* Rating Badge */}
            {partyRating && formData.party_id && (() => {
              const ratingConfig = {
                'A+': { bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', text: 'text-white', label: 'Excellent', stars: 5, icon: '🌟' },
                'A': { bg: 'bg-gradient-to-r from-green-500 to-green-600', text: 'text-white', label: 'Good', stars: 4, icon: '⭐' },
                'B': { bg: 'bg-gradient-to-r from-blue-500 to-blue-600', text: 'text-white', label: 'Average', stars: 3, icon: '📊' },
                'C': { bg: 'bg-gradient-to-r from-amber-500 to-amber-600', text: 'text-white', label: 'Below Average', stars: 2, icon: '⚠️' },
                'D': { bg: 'bg-gradient-to-r from-red-600 to-red-700', text: 'text-white', label: 'Delay', stars: 1, icon: '🚫' },
              };
              const config = ratingConfig[partyRating] || ratingConfig['B'];
              return (
                <div className={`mt-2 px-3 py-2 rounded-lg ${config.bg} ${config.text} flex items-center gap-2 shadow-sm`}>
                  <span className="text-base">{config.icon}</span>
                  <span className="font-bold text-sm">{partyRating}</span>
                  <span className="text-xs opacity-90">• {config.label}</span>
                  <div className="ml-auto flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= config.stars ? 'fill-yellow-300 text-yellow-300' : 'text-white/30'}`} />
                    ))}
                  </div>
                </div>
              );
            })()}
            {partyOutstanding !== null && formData.party_id && (
              <div className={`mt-2 px-3 py-1.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${
                partyOutstanding > 0 
                  ? 'bg-red-50 text-red-700 border border-red-200' 
                  : partyOutstanding < 0 
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>
                Outstanding: ₹{Math.abs(partyOutstanding).toFixed(2)}
                {partyOutstanding > 0 ? ' (Due)' : partyOutstanding < 0 ? ' (Advance)' : ' (Clear)'}
              </div>
            )}
          </FormField>

          <FormField label="Date" required>
            <input
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
            />
          </FormField>

          <FormField label="Purchase Type" required>
            <div className="flex space-x-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="purchase_type"
                  value="kaccha"
                  checked={formData.purchase_type === 'kaccha'}
                  onChange={e => setFormData({ ...formData, purchase_type: e.target.value })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-slate-700">K</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="purchase_type"
                  value="pakka"
                  checked={formData.purchase_type === 'pakka'}
                  onChange={e => setFormData({ ...formData, purchase_type: e.target.value })}
                  className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-slate-700">P</span>
              </label>
            </div>
          </FormField>

          {formData.party_id && (
            <FormField label="Coupon (Optional)">
              <select
                value={formData.coupon_no}
                onChange={e => setFormData({ ...formData, coupon_no: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition bg-white"
              >
                <option value="">No Coupon</option>
                {coupons.filter(c => c.party_id === formData.party_id).map(c => (
                  <option key={c.id} value={c.coupon_no}>{c.coupon_no} - {c.scheme_name}</option>
                ))}
              </select>
            </FormField>
          )}
        </div>

        {/* Invoice Info */}
        <div className="col-span-12 lg:col-span-4 bg-primary-900 text-white p-5 rounded-xl shadow-sm flex flex-col justify-center">
          <p className="text-primary-200 text-sm font-medium mb-1">Invoice Number</p>
          <p className="text-2xl font-bold mb-4">{invoiceNo}</p>
          <p className="text-primary-200 text-sm font-medium mb-1">Season</p>
          <p className="text-lg font-medium">{activeSeason.name}</p>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3 min-w-[250px]">Product</th>
                <th className="px-4 py-3 w-40">Batch</th>
                <th className="px-4 py-3 w-32">MFG Date</th>
                <th className="px-4 py-3 w-24">Qty</th>
                <th className="px-4 py-3 w-24">Unit</th>
                <th className="px-4 py-3 w-32">Rate (₹)</th>
                <th className="px-4 py-3 w-32">Amount (₹)</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 font-medium text-slate-500">{index + 1}</td>
                  <td className="px-4 py-2">
                    <SearchableSelect
                      options={products.map(p => ({ value: p.id, label: p.name, sublabel: p.category }))}
                      value={item.product_id}
                      onChange={v => handleItemChange(index, 'product_id', v)}
                      placeholder="Select Product"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      list={`batches-list-${index}`}
                      value={item.batch_no || ''}
                      onChange={e => {
                        const val = e.target.value;
                        const matchingBatch = item.batches.find(b => b.batch_no === val);
                        handleItemChange(index, 'batch_no', val);
                        if (matchingBatch) {
                          handleItemChange(index, 'batch_id', matchingBatch.id);
                          if (matchingBatch.mfg_date) {
                            handleItemChange(index, 'mfg_date', matchingBatch.mfg_date);
                          }
                        } else {
                          handleItemChange(index, 'batch_id', '');
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                      disabled={!item.product_id}
                      placeholder="Type batch"
                    />
                    <datalist id={`batches-list-${index}`}>
                      {item.batches.map(b => (
                        <option key={b.id} value={b.batch_no} />
                      ))}
                    </datalist>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="month"
                      value={item.mfg_date}
                      onChange={e => handleItemChange(index, 'mfg_date', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none uppercase"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.qty}
                      onChange={e => handleItemChange(index, 'qty', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {(() => {
                      const prod = products.find(p => p.id === item.product_id);
                      if (prod && prod.alt_unit) {
                        return (
                          <select
                            value={item.unit}
                            onChange={e => handleItemChange(index, 'unit', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                          >
                            <option value={prod.unit}>{prod.unit}</option>
                            <option value={prod.alt_unit}>{prod.alt_unit}</option>
                          </select>
                        );
                      }
                      return (
                        <input
                          type="text"
                          value={item.unit}
                          readOnly
                          className="w-full px-2 py-1.5 border border-slate-200 bg-slate-50 text-slate-500 rounded outline-none cursor-not-allowed"
                        />
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate}
                      onChange={e => handleItemChange(index, 'rate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {item.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => removeItemRow(index)}
                      disabled={items.length === 1}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-200">
          <button
            onClick={addItemRow}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded transition"
          >
            <PlusCircle className="w-4 h-4 mr-1.5" /> Add Row
          </button>
        </div>
      </div>

      {/* Footer Calculations & Payment */}
      <div className="grid grid-cols-12 gap-6 mb-10">
        <div className="col-span-12 lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <FormField label="Remarks">
            <textarea
              rows="3"
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition"
              placeholder="Any additional notes..."
            />
          </FormField>
        </div>

        <div className="col-span-12 lg:col-span-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-600 font-medium">Subtotal:</span>
              <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-600 font-medium flex items-center">
                Discount (₹):
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.discount}
                onChange={e => setFormData({ ...formData, discount: e.target.value })}
                className="w-32 px-2 py-1 text-right border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
              />
            </div>

            {formData.purchase_type === 'pakka' && (
              <>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600 font-medium flex items-center">
                    CGST (%):
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.cgst_percent}
                      onChange={e => setFormData({ ...formData, cgst_percent: e.target.value })}
                      className="w-16 ml-2 px-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-600 font-medium flex items-center">
                    SGST (%):
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.sgst_percent}
                      onChange={e => setFormData({ ...formData, sgst_percent: e.target.value })}
                      className="w-16 ml-2 px-1 text-center border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none"
                    />
                  </span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-lg font-bold text-slate-800">Grand Total:</span>
              <span className="text-xl font-bold text-primary-700">₹{grandTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between items-center py-1 mt-2">
              <span className="text-slate-600 font-medium flex items-center">
                Amount Paid (₹):
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.amount_paid}
                onChange={e => setFormData({ ...formData, amount_paid: e.target.value })}
                className="w-32 px-2 py-1 text-right border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 outline-none font-medium"
              />
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="font-semibold text-slate-700">Balance Due:</span>
              <span className={`font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{balanceDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Buttons at Bottom */}
      <div className="flex justify-end space-x-3 mb-6 pt-2">
        <button
          onClick={() => handleSave(false)}
          className="px-6 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-medium transition flex items-center shadow-sm"
        >
          <Save className="w-4 h-4 mr-2" /> Save
        </button>
        <button
          onClick={() => handleSave(true)}
          className="px-6 py-2.5 bg-white border-2 border-primary-700 text-primary-700 hover:bg-primary-50 rounded-lg font-medium transition flex items-center shadow-sm"
        >
          <Printer className="w-4 h-4 mr-2" /> Save & Print
        </button>
      </div>

      {/* Delay Warning Modal */}
      {showDelayWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-[pulse_0.3s_ease-in-out]">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">⚠️ Delay Alert!</h3>
                <p className="text-red-100 text-sm">This party is rated D</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-slate-700 text-base mb-2">
                <strong>{parties.find(p => p.value === formData.party_id)?.label}</strong> is marked as a <span className="text-red-600 font-bold">Delay</span>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <p className="text-amber-800 font-semibold text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Please confirm with Pintu Sir before billing this party.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDelayWarning(false);
                    setFormData(prev => ({ ...prev, party_id: '' }));
                    setPartyRating(null);
                    setPartyOutstanding(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowDelayWarning(false)}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                >
                  Confirmed by Pintu Sir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
