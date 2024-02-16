'use strict';
/**
 * Encodes a string into a base64 string with an email-safe line width
 *
 * @param {string} str String the string to encode
 * @param {string} characterEncoding String the character encoding (i.e. 'ISO-8859-1')
 *
 * @return {string} The encoded string
 */
function encodeBase64ForEmail(str, characterEncoding) {
    var StringUtils = require('dw/util/StringUtils');
    var StringWriter = require('dw/io/StringWriter');
    var strBase64 = StringUtils.encodeBase64(str, characterEncoding);
    var strBase64LB = '';
    var stringWriter = new StringWriter();

    var offset = 0;
    var length = 76;

    while (offset < strBase64.length) {
        var maxOffset = offset + length;

        if (strBase64.length >= maxOffset) {
            stringWriter.write(strBase64, offset, length);
            stringWriter.write('\n');
        } else {
            stringWriter.write(strBase64, offset, length - (maxOffset - strBase64.length));
        }
        offset += length;
    }

    stringWriter.flush();
    strBase64LB = stringWriter.toString();
    stringWriter.close();

    return strBase64LB;
}


function OrderObj (orderItem) {
    this.name = orderItem.productName
    this.quantity = orderItem.quantityValue
    this.price = orderItem.priceValue
}




function addFilesToMailAttributes(mailAttributes, order) {
var Map = require('dw/util/HashMap');
var jsPDF = require('jsPDF')
var StringUtils = require('dw/util/StringUtils');
var Calendar = require('dw/util/Calendar');

// Create a new jsPDF instance
const doc = new jsPDF();
var orderItem = null
var items = []
var orderObj = {}
var orderItems = order.productLineItems.iterator();
while (orderItems.hasNext()) {
    orderItem = orderItems.next()
    var orderObj = new OrderObj(orderItem)
    items.push(orderObj)
}

// Define order details
const orderDetails = {
  orderId: order.orderNo,
  date: StringUtils.formatCalendar(new Calendar(order.getCreationDate()), 'yyyy-MM-dd'),
  customerName: order.customerName,
  items: items
};

// Function to draw the order invoice
const drawInvoice = () => {
  // Set font size and style
  doc.setFontSize(12);

  // Draw invoice title with enhanced styling
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.text('Invoice', 90, 20);

  // Draw order details with bold font and underline
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Order ID:', 10, 40);
  doc.text(orderDetails.orderId, 50, 40);
  doc.text('Date:', 120, 40);
  doc.text(orderDetails.date, 150, 40);
  doc.text('Customer Name:', 10, 50);
  doc.text(orderDetails.customerName, 50, 50);

  // Draw table headers with enhanced styling
  doc.setLineWidth(1);
  doc.rect(10, 60, 190, 10, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Item', 15, 65);
  doc.text('Quantity', 100, 65);
  doc.text('Price', 130, 65);

  // Loop through items and draw with bold font
  let y = 70;
  orderDetails.items.forEach((item) => {
    doc.rect(10, y, 190, 10, 'S');
    doc.setFont('helvetica', 'normal');
    doc.text(item.name, 15, y + 5);
    doc.text(item.quantity.toString(), 100, y + 5);
    doc.text('$' + item.price.toFixed(2), 130, y + 5);
    y += 10;
  });

  doc.rect(10, y, 190, 10, 'S');
  doc.setFont('helvetica', 'bold');
  doc.text('Shipping:', 15, y + 5);
  doc.text('$' + order.shippingTotalPrice.value, 130, y + 5);
  y += 10;

  doc.rect(10, y, 190, 10, 'S');
  doc.setFont('helvetica', 'bold');
  doc.text('Tax:', 15, y + 5);
  doc.text('$' + order.totalTax.value, 130, y + 5);
  y += 10;
  
  // Draw total with enhanced styling
  doc.rect(10, y, 190, 10, 'S');
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 15, y + 5);
  doc.text('$' + order.totalGrossPrice.value, 130, y + 5);
};

// Call drawInvoice function
drawInvoice();
    var pdfContent= doc.output()
    var files = new Map();

    files.put('test.pdf', encodeBase64ForEmail(pdfContent, 'ISO-8859-1'));

    mailAttributes.put('Base64FileMap', files);
}



module.exports.PDFGenScript = function () {
    var Map = require('dw/util/HashMap');
    var Template = require('dw/util/Template');
    var Mail = require('dw/net/Mail');
    var OrderMgr = require('dw/order/OrderMgr');
    var Order = require('dw/order/Order');

    // Create the template that we will use to send the email.
    var template = new Template('mail/testMail.isml');

    // Work with a HashMap to pass the data to the template.
    var mailAttributes = new Map();
    mailAttributes.put('EmailMessage', 'Test Message');


    var orders = OrderMgr.searchOrders('status != {0} and creationDate >= {1}', 'creationDate asc',Order.ORDER_STATUS_FAILED,new Date('2024-01-31'))
    var order = null
    while (orders.hasNext()) {
        order = orders.next()
        addFilesToMailAttributes(mailAttributes, order);
        var mail = new Mail();
        // Render the template with the data in the Hash
        var content = template.render(mailAttributes);

        mail.addTo('faizen.rashid@cognizant.com');
        mail.setFrom('info@forward.eu');
        mail.setSubject('Example Email');
        mail.setContent(content);
        mail.send()

    }
}