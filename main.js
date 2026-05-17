/**
 * Gửi lead lên Supabase (PostgREST).
 * Bảng `leads` cần có các cột:
 * name, email, phone,
 * want_register_now, want_consultation, want_join_community.
 */
const SUPABASE_REST_BASE = 'https://rhqmzccyvfiitojeqkfr.supabase.co/rest/v1';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_EGy6mohkRIoPQt1RErhrRw_jr8FaqRr';

const form = document.getElementById('leadCaptureForm');
const submitBtn = document.getElementById('leadSubmitBtn');
const btnText = submitBtn?.querySelector('.btn-text');
const btnLoading = submitBtn?.querySelector('.btn-loading');
const messageEl = document.getElementById('leadFormMessage');
const leadModal = document.getElementById('leadModal');
const modalCloseBtn = document.getElementById('leadModalCloseBtn');
const openModalTriggers = document.querySelectorAll('[data-open-lead-form]');
const closeModalTriggers = document.querySelectorAll('[data-close-lead-form]');
const consultationModal = document.getElementById('consultationModal');
const consultationModalCloseBtn = document.getElementById('consultationModalCloseBtn');
const openConsultationModalTriggers = document.querySelectorAll('[data-open-consultation-modal]');
const closeConsultationModalTriggers = document.querySelectorAll('[data-close-consultation-modal]');
const leadOptRegisterNow = document.getElementById('leadOptRegisterNow');
const leadOptConsultation = document.getElementById('leadOptConsultation');
const leadOptCommunity = document.getElementById('leadOptCommunity');
const leadPhoneInput = document.getElementById('leadPhone');
const paymentQrImage = document.getElementById('paymentQrImage');
const paymentTransferContent = document.getElementById('paymentTransferContent');

const PAYMENT_QR_BASE = 'https://qr.sepay.vn/img?acc=4358967&bank=ACB&amount=1000000';
const PAYMENT_TRANSFER_PREFIX = 'MQL5_Coc';

const leadOptionInputs = {
  register_now: leadOptRegisterNow,
  consultation: leadOptConsultation,
  community: leadOptCommunity,
};

function presetLeadOptions(leadType) {
  Object.values(leadOptionInputs).forEach((input) => {
    if (input) input.checked = false;
  });

  if (!leadType) return;
  const selectedInput = leadOptionInputs[leadType];
  if (selectedInput) selectedInput.checked = true;
}

function buildPaymentDescription(phone) {
  const phoneDigits = String(phone ?? '').replace(/\D/g, '');
  return phoneDigits ? `${PAYMENT_TRANSFER_PREFIX}_${phoneDigits}` : PAYMENT_TRANSFER_PREFIX;
}

function updatePaymentQr() {
  const description = buildPaymentDescription(leadPhoneInput?.value);
  if (paymentTransferContent) paymentTransferContent.textContent = description;
  if (paymentQrImage) {
    paymentQrImage.src = `${PAYMENT_QR_BASE}&des=${encodeURIComponent(description)}`;
  }
}

function openLeadModal(leadType) {
  if (!leadModal) return;
  presetLeadOptions(leadType);
  leadModal.classList.add('open');
  leadModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeLeadModal() {
  if (!leadModal) return;
  leadModal.classList.remove('open');
  leadModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function openConsultationModal() {
  if (!consultationModal) return;
  consultationModal.classList.add('open');
  consultationModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeConsultationModal() {
  if (!consultationModal) return;
  consultationModal.classList.remove('open');
  consultationModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

openModalTriggers.forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openLeadModal(trigger.dataset.leadType);
  });
});

closeModalTriggers.forEach((trigger) => {
  trigger.addEventListener('click', closeLeadModal);
});

modalCloseBtn?.addEventListener('click', closeLeadModal);
leadPhoneInput?.addEventListener('input', updatePaymentQr);
updatePaymentQr();
openConsultationModalTriggers.forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openConsultationModal();
  });
});
closeConsultationModalTriggers.forEach((trigger) => {
  trigger.addEventListener('click', closeConsultationModal);
});
consultationModalCloseBtn?.addEventListener('click', closeConsultationModal);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeLeadModal();
  closeConsultationModal();
});

function setLoading(loading) {
  if (!submitBtn) return;
  submitBtn.disabled = loading;
  if (btnText) btnText.hidden = loading;
  if (btnLoading) btnLoading.hidden = !loading;
}

function showMessage(text, type) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.classList.remove('success', 'error');
  if (type) messageEl.classList.add(type);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMessage('');

  const nameInput = document.getElementById('leadName');
  const emailInput = document.getElementById('leadEmail');
  const phoneInput = document.getElementById('leadPhone');

  const name = nameInput?.value.trim() ?? '';
  const email = emailInput?.value.trim() ?? '';
  const phone = phoneInput?.value.trim() ?? '';
  const wantRegisterNow = Boolean(leadOptRegisterNow?.checked);
  const wantConsultation = Boolean(leadOptConsultation?.checked);
  const wantJoinCommunity = Boolean(leadOptCommunity?.checked);

  if (!name || !email || !phone) {
    showMessage('Vui lòng điền đủ các trường bắt buộc.', 'error');
    return;
  }

  if (!wantRegisterNow && !wantConsultation && !wantJoinCommunity) {
    showMessage('Vui lòng chọn ít nhất một nhu cầu tư vấn.', 'error');
    return;
  }

  const payload = {
    name,
    email,
    phone,
    want_register_now: wantRegisterNow,
    want_consultation: wantConsultation,
    want_join_community: wantJoinCommunity,
  };

  setLoading(true);
  try {
    const res = await fetch(`${SUPABASE_REST_BASE}/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showMessage('Đã nhận thông tin. Mình sẽ đọc case và phản hồi sớm.', 'success');
      form.reset();
      updatePaymentQr();
      setTimeout(closeLeadModal, 1200);
    } else {
      let detail = '';
      try {
        const errBody = await res.json();
        if (errBody?.message) detail = ` ${String(errBody.message)}`;
        else if (errBody?.hint) detail = ` ${String(errBody.hint)}`;
        else if (typeof errBody === 'string') detail = ` ${errBody}`;
      } catch {
        /* ignore */
      }
      showMessage(`Có lỗi xảy ra.${detail}`, 'error');
    }
  } catch {
    showMessage('Có lỗi xảy ra', 'error');
  } finally {
    setLoading(false);
  }
});

// Sales chatbot based on sales_script.md
const WAITLIST_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLScji7NfQqHB9DcvLvEzVWLrYEANddj5KxgXmy1Nj9pW60O9XQ/viewform';

const chatbot = document.getElementById('salesChatbot');
const chatbotToggle = document.getElementById('chatbotToggle');
const chatbotClose = document.getElementById('chatbotClose');
const chatbotPanel = document.getElementById('chatbotPanel');
const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotForm = document.getElementById('chatbotForm');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSuggestions = document.getElementById('chatbotSuggestions');
let chatbotHasGreeted = false;
let chatbotMessageQueueDelay = 0;

const chatbotGreeting =
  'Chào bạn, mình là trợ lý của Hùng AAI.\n\nTrước khi nói về bot hay code, mình muốn hiểu case thật của bạn trước: bạn đang trade theo rule nào, đã có EA/backtest/log chưa, và phần đang kẹt nhất là rule, code, risk hay vận hành?\n\nCoaching này không bán lời hứa lợi nhuận. Mục tiêu là giúp bạn làm rõ hệ thống: rule đủ rõ để code, risk có phanh, backtest/forward test có kiểm chứng, và bot chạy theo thứ bạn hiểu được.';

const chatbotFallback =
  'Mình chưa chắc đã hiểu đúng ý bạn. Bạn có thể hỏi theo các hướng như: chưa biết code, sợ bot cháy tài khoản, đã có EA, MQL5 khó, có cam kết lợi nhuận không, hoặc bước tiếp theo để tư vấn.\n\nNếu muốn mình soi case cụ thể, bạn có thể để lại thông tin qua form danh sách chờ.';

const chatbotAnswers = [
  {
    keywords: ['chua biet code', 'khong biet code', 'moi bat dau', 'khong ranh code'],
    answer:
      'Được, nếu bạn sẵn sàng đi từ rule trước.\n\nMình không bắt đầu bằng việc nhảy thẳng vào một con EA phức tạp. Bước đầu là viết lại cách bạn ra quyết định thành checklist: khi nào vào lệnh, khi nào thoát, khi nào không trade, rủi ro mỗi lệnh là bao nhiêu. Sau đó mới chuyển từng phần sang MQL5.\n\nBạn không cần thành lập trình viên ngay. Nhưng bạn cần hiểu đủ để biết bot đang làm gì với tài khoản của mình.',
  },
  {
    keywords: ['chay tai khoan', 'chay tk', 'so bot', 'mat tien', 'rui ro bot'],
    answer:
      'Sợ vậy là đúng. Bot không có risk engine thì rất nguy hiểm.\n\nMột bot nghiêm túc phải có phanh: risk/lệnh, daily loss, max drawdown, số lệnh tối đa, điều kiện không trade, log và điều kiện dừng. Trước khi nghĩ đến chạy live, phải có backtest, forward test hoặc demo đủ rõ.\n\nBot không làm bạn kỷ luật hơn nếu trong code không có kỷ luật.',
  },
  {
    keywords: ['mua ea', 'ea bi lo', 'tung mua', 'bot bi lo', 'ea lo'],
    answer:
      'Có thể nên học tiếp, nhưng không phải để mua thêm một con bot khác.\n\nViệc cần làm là đọc lại hệ thống cũ: EA đó vào lệnh theo rule nào, risk giới hạn ra sao, backtest có sạch không, live lệch vì spread/slippage/dữ liệu hay vì logic không còn phù hợp. Cái đau nhất khi mua EA bị lỗ thường không chỉ là mất tiền, mà là không biết vì sao mình mất.\n\nCoaching giúp bạn bớt vận hành bot như một hộp đen.',
  },
  {
    keywords: ['chua co chien luoc', 'chien luoc chua ro', 'rule chua ro', 'chua ro rule', 'cam tinh'],
    answer:
      'Chưa nên vội làm bot hoàn chỉnh.\n\nNếu rule còn kiểu "nhìn đẹp thì vào", "tùy bối cảnh", "cảm giác ổn thì giữ lệnh", thì code chỉ làm sự mơ hồ đó chạy đều hơn. Bước đầu nên bóc tách chiến lược hiện tại thành checklist đo được. Nếu checklist còn chưa rõ, mình tập trung làm rõ rule trước.\n\nBot chỉ khuếch đại mức độ rõ ràng trong tư duy trader.',
  },
  {
    keywords: ['mql5 kho', 'hoc mql5', 'kho qua', 'lap trinh kho', 'code kho'],
    answer:
      'MQL5 khó nếu học lan man hoặc học toàn cú pháp mà không gắn với case thật.\n\nTrong coaching, mình chia nhỏ theo nhu cầu: biến, điều kiện, hàm, đọc dữ liệu nến, kiểm tra tín hiệu, gửi lệnh, quản lý lệnh, trailing stop, log, risk engine. Học đến đâu dùng vào bot của bạn đến đó.\n\nKhông cần phức tạp hóa. Cái cần là hiểu từng module đang giải quyết vấn đề gì.',
  },
  {
    keywords: ['da co ea', 'co ea roi', 'co bot roi', 'review bot', 'review ea', 'sua ea', 'debug'],
    answer:
      'Không nhất thiết phải học lại từ đầu.\n\nNếu bạn đã có EA, mình có thể bắt đầu bằng review: rule, code, backtest, risk engine, log và quy trình vận hành. Có người chỉ cần sửa risk. Có người cần viết lại log. Có người cần soi lại rule vì backtest đẹp nhưng live lệch.\n\nCoaching 1:1 không nhồi một giáo trình cho tất cả. Mình soi case trước, rồi mới chọn module.',
  },
  {
    keywords: ['ai code', 'dung ai', 'chatgpt', 'ai viet code', 'tu lam bang ai'],
    answer:
      'Có dùng AI. AI rất hữu ích để viết code, debug, refactor và giải thích lỗi.\n\nNhưng AI không thay bạn định nghĩa rule. Nếu yêu cầu mơ hồ, AI chỉ giúp tự động hóa sự mơ hồ nhanh hơn. Trong coaching, AI được dùng như đòn bẩy, không phải phép màu.\n\nNgười chịu trách nhiệm cuối cùng vẫn là trader vận hành hệ thống.',
  },
  {
    keywords: ['cam ket loi nhuan', 'loi nhuan', 'co lai khong', 'bao loi nhuan', 'chac thang'],
    answer:
      'Không.\n\nTrading luôn có rủi ro. Không ai nghiêm túc nên cam kết lợi nhuận từ bot, MQL5 hay AI. Coaching này chỉ giúp bạn rõ rule hơn, kiểm chứng tốt hơn, quản trị rủi ro chặt hơn và vận hành có trách nhiệm hơn.\n\nKết quả vẫn phụ thuộc vào chiến lược, dữ liệu, thị trường, risk và kỷ luật của bạn.',
  },
  {
    keywords: ['gia bao nhieu', 'hoc phi', 'chi phi', 'hoi cao', 'dat qua', 'bao gia'],
    answer:
      'Mình hiểu. Nhưng nên nhìn chi phí này theo góc khác: bạn đang trả cho khả năng tự soi hệ thống, không chỉ một file EA.\n\nNếu tiếp tục đổi indicator, mua EA không hiểu, thuê sửa lỗi lặp lại hoặc chạy live một hệ thống chưa có risk, chi phí thật có thể lớn hơn nhiều. Giá trị của coaching nằm ở việc bạn hiểu rule, đọc được logic, biết kiểm chứng và biết khi nào không nên chạy bot.\n\nNếu case của bạn chưa phù hợp để coaching, mình cũng sẽ nói thẳng.',
    showCta: true,
  },
  {
    keywords: ['bot chay tu dong', 'khong muon hoc', 'chay auto', 'tu dong hoa', 'chi muon bot'],
    answer:
      'Tự động hóa được. Nhưng không nên giao tài khoản cho một thứ bạn hoàn toàn không hiểu.\n\nBạn không cần học để thành coder. Nhưng cần hiểu tối thiểu: bot vào lệnh vì điều kiện nào, thoát vì điều kiện nào, risk giới hạn ra sao, khi nào bot phải dừng, và log đang nói gì.\n\nAutomation không làm con người giỏi hơn. Nó làm điểm mạnh và điểm yếu lộ rõ hơn, nhanh hơn.',
  },
];

const chatbotInterestKeywords = [
  'tu van',
  'dang ky',
  'hoc',
  'mua',
  'buoc tiep',
  'tiep theo',
  'form',
  'lien he',
  'cho minh',
  'quan tam',
  'coaching',
  'waitlist',
];

function normalizeChatText(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function addChatMessage(text, sender = 'bot', showCta = false) {
  if (!chatbotMessages) return;
  const message = document.createElement('div');
  message.className = `chatbot-message ${sender}`;
  message.textContent = text;

  if (showCta) {
    const link = document.createElement('a');
    link.className = 'chatbot-cta';
    link.href = WAITLIST_FORM_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Điền form danh sách chờ';
    message.appendChild(link);
  }

  chatbotMessages.appendChild(message);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function splitBotReply(text) {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addBotReply(text, showCta = false) {
  const parts = splitBotReply(text);
  if (!parts.length) return;

  parts.forEach((part, index) => {
    const isLastPart = index === parts.length - 1;
    const delay = chatbotMessageQueueDelay + 420 + index * 520;

    window.setTimeout(() => {
      addChatMessage(part, 'bot', showCta && isLastPart);
    }, delay);
  });

  chatbotMessageQueueDelay += 420 + parts.length * 520;
  window.setTimeout(() => {
    chatbotMessageQueueDelay = Math.max(0, chatbotMessageQueueDelay - (420 + parts.length * 520));
  }, chatbotMessageQueueDelay + 80);
}

function shouldShowChatCta(normalizedText) {
  return chatbotInterestKeywords.some((keyword) => normalizedText.includes(keyword));
}

function getChatbotReply(question) {
  const normalizedQuestion = normalizeChatText(question);
  const matchedAnswer = chatbotAnswers.find((item) =>
    item.keywords.some((keyword) => normalizedQuestion.includes(keyword))
  );

  if (matchedAnswer) {
    return {
      text: matchedAnswer.answer,
      showCta: Boolean(matchedAnswer.showCta || shouldShowChatCta(normalizedQuestion)),
    };
  }

  if (shouldShowChatCta(normalizedQuestion)) {
    return {
      text:
        'Nếu bạn muốn tư vấn hoặc xem bước tiếp theo, cách tốt nhất là gửi case thật trước.\n\nBạn ghi rõ mình đang trade gì, rule hiện tại ra sao, đã có EA/backtest/log chưa và phần đang kẹt nhất là gì.\n\nMình đọc trước rồi mới phản hồi hướng phù hợp, không chốt nóng.',
      showCta: true,
    };
  }

  return {
    text: chatbotFallback,
    showCta: true,
  };
}

function openChatbot() {
  if (!chatbot || !chatbotPanel || !chatbotToggle) return;
  chatbot.classList.add('open');
  chatbotPanel.setAttribute('aria-hidden', 'false');
  chatbotToggle.setAttribute('aria-expanded', 'true');

  if (!chatbotHasGreeted) {
    addBotReply(chatbotGreeting);
    chatbotHasGreeted = true;
  }

  setTimeout(() => chatbotInput?.focus(), 80);
}

function closeChatbot() {
  if (!chatbot || !chatbotPanel || !chatbotToggle) return;
  chatbot.classList.remove('open');
  chatbotPanel.setAttribute('aria-hidden', 'true');
  chatbotToggle.setAttribute('aria-expanded', 'false');
}

function handleChatQuestion(question) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) return;
  addChatMessage(trimmedQuestion, 'user');
  const reply = getChatbotReply(trimmedQuestion);
  addBotReply(reply.text, reply.showCta);
}

chatbotToggle?.addEventListener('click', () => {
  if (chatbot?.classList.contains('open')) closeChatbot();
  else openChatbot();
});

chatbotClose?.addEventListener('click', closeChatbot);

chatbotForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const question = chatbotInput?.value ?? '';
  if (chatbotInput) chatbotInput.value = '';
  handleChatQuestion(question);
});

chatbotSuggestions?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const question = target.dataset.chatQuestion;
  if (question) handleChatQuestion(question);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeChatbot();
});
